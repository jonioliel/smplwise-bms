"""Operator-started row jobs with progress committed beside each desired change.

Stopping affects unsaved rows only. Saved access changes keep reconciling; cancellation
never grants access back or pretends to undo an already committed operation.
"""

from __future__ import annotations

import asyncio
import csv
import inspect
import io
import re
from collections.abc import Awaitable, Callable
from contextvars import Context, ContextVar
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from .. import native_checkpoint_owner
from ..bridge_command_scope import _SCOPE
from ..trusted_actions.source_bindings import same_ports
from ..trusted_actions.source_commit_guard import source_commit
from ..trusted_actions.validation import Refusal
from . import checkpoint_peer_binding, job_approval
from .admin_audit import audit_actor
from .csv_transfer import desired_fields, validate_csv_targets
from .models import AccessError, ManagedUser, utc_now

if TYPE_CHECKING:
    from .manager import AccessManager

STATES = {"paused", "running", "completed", "completed_with_errors", "cancelled"}
ROW_STATES = {"pending", "saved", "failed"}
_worker_owners = ContextVar("wiskey_checkpoint_worker_owners", default=())
_bridge_worker = ContextVar("wiskey_native_checkpoint_execution", default=None)


@dataclass(frozen=True, repr=False)
class _CheckpointOwner:
    manager: Any
    repository: Any
    authorize: Any
    tasks: dict
    workers: Any
    ports: tuple
    active: dict
    life: list


def validate(data: Any) -> None:
    try:
        if not isinstance(data, dict) or len(data) > 100:
            raise ValueError
        if sum(len(job.get("rows", [])) for job in data.values()) > 5000:
            raise ValueError
        for identity, job in data.items():
            if not isinstance(job, dict) or set(job) - {
                "approval",
                "source_binding",
                "bridge_owner",
            } != {
                "id",
                "actor",
                "kind",
                "state",
                "revision",
                "created_at",
                "updated_at",
                "rules",
                "rows",
            }:
                raise ValueError
            job_approval.validate(job)
            if "bridge_owner" in job:
                native_checkpoint_owner.validate_origin(job["bridge_owner"])
                if "source_binding" in job:
                    raise AccessError("invalid_storage")
            if identity != job["id"] or not re.fullmatch(r"[0-9a-f]{32}", identity):
                raise ValueError
            if job["kind"] not in {"csv", "bulk"} or job["state"] not in STATES:
                raise ValueError
            if type(job["revision"]) is not int or job["revision"] < 1:
                raise ValueError
            if not isinstance(job["actor"], str) or not 1 <= len(job["actor"]) <= 128:
                raise ValueError
            if not isinstance(job["rows"], list) or not 1 <= len(job["rows"]) <= 2000:
                raise ValueError
            if not isinstance(job["rules"], str) or not 1 <= len(job["rules"]) <= 128:
                raise ValueError
            for key in ("created_at", "updated_at"):
                if datetime.fromisoformat(job[key]).tzinfo is None:
                    raise ValueError
            for index, row in enumerate(job["rows"]):
                if not isinstance(row, dict) or set(row) != {
                    "index",
                    "state",
                    "error",
                    "change",
                    "source_line",
                }:
                    raise ValueError
                if type(row["index"]) is not int or row["index"] != index + 1:
                    raise ValueError
                if type(row["source_line"]) is not int or not 1 <= row["source_line"] <= 10000:
                    raise ValueError
                if row["error"] is not None and (
                    not isinstance(row["error"], str)
                    or not re.fullmatch(r"[a-z_]{1,64}", row["error"])
                ):
                    raise ValueError
                if row["state"] not in ROW_STATES or not isinstance(row["change"], dict):
                    raise ValueError
                change = row["change"]
                if (
                    row["state"] != "saved"
                    and job["state"] != "cancelled"
                    and (
                        not {"user_id", "revision", "data"} <= set(change)
                        or set(change) - {"user_id", "revision", "data", "delete"}
                        or not isinstance(change["data"], dict)
                    )
                ):
                    raise ValueError
                if change:
                    uid, revision = change["user_id"], change["revision"]
                    if uid is not None and (not isinstance(uid, str) or not 1 <= len(uid) <= 64):
                        raise ValueError
                    if uid is not None and (type(revision) is not int or revision < 1):
                        raise ValueError
                    if uid is None and revision is not None:
                        raise ValueError
                    if "delete" in change and type(change["delete"]) is not bool:
                        raise ValueError
            checkpoint_peer_binding.validate(job)
            if job["state"] == "running":
                # A restart always requires an operator to inspect and resume.
                job["state"] = "paused"
    except (KeyError, TypeError, ValueError, RecursionError, Refusal):
        raise AccessError("invalid_storage") from None


class CheckpointJobs:
    def __init__(
        self,
        manager: AccessManager,
        authorize: Callable[[str], Awaitable[bool]],
        *,
        scope_guard: Callable[[], None] | None = None,
        row_guard: Callable[[dict[str, Any], ManagedUser | None, ManagedUser | None], None | str]
        | None = None,
        peer_message: Any = None,
        owner_lease: Any = None,
    ) -> None:
        if any(
            port is not None and (not callable(port) or inspect.iscoroutinefunction(port))
            for port in (scope_guard, row_guard)
        ):
            raise ValueError("extra row/scope fences must be synchronous refusal guards")
        self.manager = manager
        self.authorize = authorize
        self.scope_guard, self.row_guard = scope_guard, row_guard
        if peer_message is not None and (scope_guard is None or row_guard is None):
            raise ValueError("peer-bound jobs require current authority and actual person scope")
        self.peer_message = peer_message
        self.owner_lease = owner_lease
        self._bridge_grants = {}
        self._peer_original = (
            checkpoint_peer_binding.original(peer_message) if peer_message is not None else None
        )
        self.tasks: dict[str, asyncio.Task[None]] = {}
        self.closed = False
        self._workers = asyncio.Semaphore(2)
        self._creation = _CheckpointOwner(
            manager,
            manager.repository,
            authorize,
            self.tasks,
            self._workers,
            (
                manager._changed,
                manager.request,
                manager._csv_rules,
                manager.bulk,
                manager.bulk.rules_stamp,
                manager.repository._commit,
                manager.repository.get,
                scope_guard,
                row_guard,
                peer_message,
                self._peer_original,
                owner_lease,
                self._bridge_grants,
            ),
            {},
            [False, None],
        )

    def _check_owner(self, *, closed_ok: bool = False) -> None:
        o = self._creation
        if (
            self.manager is not o.manager
            or self.authorize is not o.authorize
            or self.tasks is not o.tasks
            or self._workers is not o.workers
            or o.manager.repository is not o.repository
            or o.manager.bulk is not o.ports[3]
            or not same_ports(
                o.ports,
                (
                    o.manager._changed,
                    o.manager.request,
                    o.manager._csv_rules,
                    o.manager.bulk,
                    o.manager.bulk.rules_stamp,
                    o.repository._commit,
                    o.repository.get,
                    self.scope_guard,
                    self.row_guard,
                    self.peer_message,
                    self._peer_original,
                    self.owner_lease,
                    self._bridge_grants,
                ),
            )
            or any(o.tasks.get(identity) is not task for task, identity in tuple(o.active.items()))
        ):
            raise AccessError("unauthorized")
        if not closed_ok and (o.life[0] or self.closed is not False or o.manager._closed):
            raise AccessError("unauthorized")

    def _worker_current(self) -> None:
        try:
            self._check_owner()
        except AccessError:
            raise AccessError("job_paused") from None

    def _bridge_execution(self):
        record = _bridge_worker.get()
        if record is None or record[0] is not self._creation:
            return None
        _owner, task, identity, grant = record
        if (
            self._creation.active.get(task) != identity
            or self._bridge_grants.get(identity) is not grant
            or type(grant) is not native_checkpoint_owner.NativeCheckpointGrant
        ):
            raise AccessError("unauthorized")
        grant.check(self, identity)
        return record

    async def _allowed(self, actor: str, *, worker=False) -> bool:
        self._check_owner()
        self._scope_current()
        record = self._bridge_execution()
        if record is not None:
            if not worker or record[1] is not asyncio.current_task():
                raise AccessError("unauthorized")
            record[3].check(self, record[2], actor)
            return True
        if native_checkpoint_owner.command_principal(actor) is not None:
            return True
        result = await self._creation.authorize(actor)
        self._check_owner()
        self._scope_current()
        return result is True

    def _requires_approval(self, state):
        lease = self._creation.ports[11]
        if lease is None:
            if self._bridge_execution() is not None:
                return False
            scope = _SCOPE.get()
            if scope is not None:
                if not scope.active:
                    raise AccessError("unauthorized")
                scope.principal.check()
                return False
            return state["workflows"]["settings"]["dual_approval"]
        from .arx_execution_authority import FeatureLease
        from .arx_feature_execution_contract import FeatureBoundary

        if type(lease) is not FeatureLease or type(lease.message._boundary) is not FeatureBoundary:
            raise AccessError("unauthorized")
        lease.require("people/write")
        if not FeatureBoundary.native_owner(lease.message._boundary, lease.message):
            raise AccessError("unauthorized")
        return False

    def _scope_current(self) -> None:
        self._check_owner()
        if self._bridge_execution() is None:
            scope = _SCOPE.get()
            if scope is not None:
                if not scope.active:
                    raise AccessError("unauthorized")
                scope.principal.check()
        guard = self._creation.ports[7]
        if self._creation.ports[9] is not None:
            self._creation.ports[9].check()
            if (
                checkpoint_peer_binding.original(self._creation.ports[9])
                != self._creation.ports[10]
            ):
                raise AccessError("unauthorized")
        if guard is not None and guard() is not None:
            raise AccessError("unauthorized")
        self._check_owner()

    def _bound_job(self, job: dict) -> None:
        checkpoint_peer_binding.check(job, self._creation.ports[10])

    def _bind_task(self, task: asyncio.Task, identity: str) -> None:
        o = self._creation
        if task in o.active:
            if o.active[task] != identity:
                raise AccessError("unauthorized")
            return
        if any(key == identity and not other.done() for other, key in o.active.items()):
            raise AccessError("unauthorized")
        o.active[task] = identity
        o.tasks[identity] = task
        task.add_done_callback(lambda done: o.active.pop(done, None))

    def records(self, actor: str) -> list[dict[str, Any]]:
        self._check_owner(closed_ok=True)
        return [
            self.public(job)
            for job in sorted(
                self._creation.repository._state["checkpoint_jobs"].values(),
                key=lambda item: item["created_at"],
                reverse=True,
            )
            if job["actor"] == actor
        ]

    @staticmethod
    def public(job: dict[str, Any]) -> dict[str, Any]:
        return {
            key: deepcopy(job[key])
            for key in ("id", "kind", "state", "revision", "created_at", "updated_at")
        } | {
            "approval": (
                {key: job["approval"][key] for key in ("state", "action", "expires_at")}
                if job.get("approval")
                else None
            ),
            "total": len(job["rows"]),
            "saved": sum(row["state"] == "saved" for row in job["rows"]),
            "failed": sum(row["state"] == "failed" for row in job["rows"]),
            "pending": sum(row["state"] == "pending" for row in job["rows"]),
            "errors": [
                {"row": row["source_line"], "code": row["error"]}
                for row in job["rows"]
                if row["state"] == "failed"
            ],
        }

    def pending_reviews(self, actor: str) -> list[dict[str, Any]]:
        self._check_owner(closed_ok=True)
        return [
            self.public(job)
            for job in self._creation.repository._state["checkpoint_jobs"].values()
            if job["actor"] != actor
            and (job.get("approval") or {}).get("state") == "pending"
            and job["state"] in {"paused", "completed_with_errors"}
        ]

    def approval_review(self, actor: str, identity: str) -> dict[str, Any]:
        self._check_owner(closed_ok=True)
        from .admin_audit import summary

        def evidence(raw: dict[str, Any] | None) -> dict[str, Any] | None:
            if raw is None:
                return None
            policy = raw.get("access_timing_policy")
            return {
                **(summary(raw) or {}),
                "timing": (
                    {"mode": policy["mode"], "schedule": deepcopy(policy["schedule"])}
                    if policy
                    else None
                ),
            }

        job = self._creation.repository._state["checkpoint_jobs"].get(identity)
        if not job or not job.get("approval"):
            raise AccessError("operation_not_found")
        receipt = job["approval"]
        if receipt["state"] != "pending" or job["state"] not in {"paused", "completed_with_errors"}:
            raise AccessError("operation_not_found")
        if selected := job_approval.selected(job, receipt["action"]):
            if selected != receipt["rows"]:
                raise AccessError("bulk_review_stale")
        else:
            raise AccessError("bulk_review_stale")
        changes = [row["change"] for row in job["rows"] if str(row["index"]) in selected]
        from .workflows import Workflows

        state = self._creation.repository._state
        candidate = Workflows(self._creation.manager)._preview(state, changes)
        added = iter(raw for uid, raw in candidate["users"].items() if uid not in state["users"])
        return {
            **self.public(job),
            "review_id": receipt["review_id"],
            "own_request": actor == job["actor"],
            "impact": [
                {
                    "before": evidence(state["users"].get(change["user_id"])),
                    "after": evidence(candidate["users"].get(change["user_id"]))
                    if change["user_id"]
                    else evidence(next(added)),
                    "fields": sorted(change["data"]),
                    "delete": bool(change.get("delete")),
                }
                for change in changes
            ],
        }

    async def approval_request(
        self, actor: str, identity: str, revision: int, action: str
    ) -> dict[str, Any]:
        if self.closed or not await self._allowed(actor):
            raise AccessError("unauthorized")

        def apply(state: dict[str, Any]) -> dict[str, Any]:
            self._check_owner()
            job = state["checkpoint_jobs"].get(identity)
            if not job or job["actor"] != actor:
                raise AccessError("operation_not_found")
            if type(revision) is not int or job["revision"] != revision:
                raise AccessError("revision_conflict")
            if job["rules"] != self._creation.manager.bulk.rules_stamp():
                raise AccessError("bulk_review_stale")
            job_approval.request(job, action)
            job["revision"] += 1
            job["updated_at"] = utc_now()
            return self.public(job)

        result = await self._creation.repository._commit(apply)
        self._check_owner()
        self._creation.manager._changed()
        return result

    async def approval_decide(
        self, actor: str, identity: str, revision: int, review_id: str, approve: bool
    ) -> dict[str, Any]:
        if self.closed or not await self._allowed(actor):
            raise AccessError("unauthorized")

        def apply(state: dict[str, Any]) -> dict[str, Any]:
            self._check_owner()
            job = state["checkpoint_jobs"].get(identity)
            if not job or not job.get("approval"):
                raise AccessError("operation_not_found")
            if actor == job["actor"]:
                raise AccessError("separate_approver_required")
            if type(revision) is not int or job["revision"] != revision:
                raise AccessError("revision_conflict")
            receipt = job["approval"]
            if receipt["state"] != "pending" or receipt["review_id"] != review_id:
                raise AccessError("bulk_review_stale")
            if datetime.fromisoformat(receipt["expires_at"]) <= datetime.now().astimezone():
                raise AccessError("approval_expired")
            if (
                job["rules"] != self._creation.manager.bulk.rules_stamp()
                or job_approval.selected(job, receipt["action"]) != receipt["rows"]
            ):
                raise AccessError("bulk_review_stale")
            # Rebuild the masked impact; changed people invalidate this review.
            self.approval_review(actor, identity)
            receipt.update(state="approved" if approve else "rejected", approver=actor)
            job["revision"] += 1
            job["updated_at"] = utc_now()
            return self.public(job)

        result = await self._creation.repository._commit(apply, offload=True)
        self._check_owner()
        self._creation.manager._changed()
        return result

    async def create(
        self,
        actor: str,
        kind: str,
        changes: list[dict[str, Any]],
        *,
        stamp: str,
        rules: str,
        request_key: str = "",
        source_lines: list[int] | None = None,
    ) -> dict[str, Any]:
        if kind not in {"csv", "bulk"} or not 1 <= len(changes) <= 2000:
            raise AccessError("job_empty_or_too_large")
        if self.closed or not await self._allowed(actor):
            raise AccessError("unauthorized")
        if self._creation.ports[10] is not None:
            if actor != self._creation.ports[9].query_owner_id:
                raise AccessError("unauthorized")
            original = self._creation.ports[10]
            request_key = (
                "arx/"
                + sha256(
                    repr(
                        (
                            original["repository_id"],
                            original["verified_peer_ref"],
                            original["original"]["operation_id"],
                        )
                    ).encode()
                ).hexdigest()
            )
        identity = self.identity(actor, kind, request_key) if request_key else uuid4().hex
        existing = self.find(actor, kind, request_key) if request_key else None
        if existing:
            self._bound_job(self._creation.repository._state["checkpoint_jobs"][identity])
            return existing
        now = utc_now()
        principal = native_checkpoint_owner.command_principal(actor)
        grant = (
            native_checkpoint_owner.NativeCheckpointGrant.issue(self, principal, actor, identity)
            if principal is not None
            else None
        )
        if source_lines is not None and len(source_lines) != len(changes):
            raise AccessError("invalid_fields")
        job = {
            "id": identity,
            "actor": actor,
            "kind": kind,
            "state": "paused",
            "revision": 1,
            "created_at": now,
            "updated_at": now,
            "rules": rules,
            "rows": [
                {
                    "index": index + 1,
                    "state": "pending",
                    "error": None,
                    "change": deepcopy(change),
                    "source_line": source_lines[index] if source_lines else index + 1,
                }
                for index, change in enumerate(changes)
            ],
        }
        if self._creation.ports[10] is not None:
            job["source_binding"] = deepcopy(self._creation.ports[10]) | {"rows": {}}
        if grant is not None:
            job["bridge_owner"] = grant.metadata(self)

        def apply(state: dict[str, Any]) -> dict[str, Any]:
            self._check_owner()
            for previous in state["checkpoint_jobs"].values():
                binding = previous.get("source_binding")
                if binding is None or self._creation.ports[10] is None:
                    continue
                expected = self._creation.ports[10]
                if (
                    previous["id"] != identity
                    and binding["repository_id"] == expected["repository_id"]
                    and binding["verified_peer_ref"] == expected["verified_peer_ref"]
                    and (
                        binding["original"]["request_id"] == expected["original"]["request_id"]
                        or binding["original"]["operation_id"]
                        == expected["original"]["operation_id"]
                    )
                ):
                    raise AccessError("operation_conflict")
            if identity in state["checkpoint_jobs"]:
                self._bound_job(state["checkpoint_jobs"][identity])
                return self.public(state["checkpoint_jobs"][identity])
            if (
                sum(len(item["rows"]) for item in state["checkpoint_jobs"].values()) + len(changes)
                > 5000
            ):
                raise AccessError("job_limit")
            if stamp != self._creation.repository.bulk_stamp(state):
                raise AccessError("bulk_review_stale")
            jobs = state["checkpoint_jobs"]
            if len(jobs) >= 100:
                finished = [
                    item
                    for item in jobs.values()
                    if not item.get("source_binding")
                    and (item["state"].startswith("completed") or item["state"] == "cancelled")
                ]
                if not finished:
                    raise AccessError("job_limit")
                del jobs[min(finished, key=lambda item: item["created_at"])["id"]]
            jobs[identity] = job
            return self.public(job)

        with source_commit(self._creation.repository, self._scope_current):
            result = await self._creation.repository._commit(apply)
        self._check_owner()
        if grant is not None:
            self._bridge_grants[identity] = grant
            for previous in tuple(self._bridge_grants):
                if previous not in self._creation.repository._state["checkpoint_jobs"] and not any(
                    key == previous and not task.done()
                    for task, key in tuple(self._creation.active.items())
                ):
                    self._bridge_grants.pop(previous)
        self._creation.manager._changed()
        return result

    @staticmethod
    def identity(actor: str, kind: str, key: str) -> str:
        return sha256(f"{actor}:{kind}:{key}".encode()).hexdigest()[:32]

    def find(self, actor: str, kind: str, key: str) -> dict[str, Any] | None:
        self._check_owner(closed_ok=True)
        job = self._creation.repository._state["checkpoint_jobs"].get(
            self.identity(actor, kind, key)
        )
        principal = native_checkpoint_owner.command_principal(actor)
        if job and principal is not None:
            native_checkpoint_owner.require_job_origin(principal, job)
        return self.public(job) if job and job["actor"] == actor else None

    async def action(self, actor: str, identity: str, revision: int, action: str) -> dict[str, Any]:
        self._check_owner()
        if action not in {"pause", "resume", "cancel", "retry_failed"}:
            raise AccessError("invalid_fields")
        if self.closed or (action in {"resume", "retry_failed"} and not await self._allowed(actor)):
            raise AccessError("unauthorized")
        observed = self._creation.repository._state["checkpoint_jobs"].get(identity)
        principal = native_checkpoint_owner.command_principal(actor)
        if observed and principal is not None:
            native_checkpoint_owner.require_job_origin(principal, observed)
            if action in {"resume", "retry_failed"}:
                if any(
                    key == identity and not task.done()
                    for task, key in tuple(self._creation.active.items())
                ):
                    raise AccessError("job_busy")
                self._bridge_grants[identity] = native_checkpoint_owner.NativeCheckpointGrant.issue(
                    self, principal, actor, identity
                )
        if observed and action in {"resume", "retry_failed"}:
            self._bound_job(observed)
        if (
            action in {"resume", "retry_failed"}
            and observed
            and observed["actor"] == actor
            and self._requires_approval(self._creation.repository._state)
        ):
            approver = job_approval.check(observed, action=action)
            if not await self._allowed(approver):
                raise AccessError("approval_required")

        def apply(state: dict[str, Any]) -> dict[str, Any]:
            self._check_owner()
            job = state["checkpoint_jobs"].get(identity)
            if not job or job["actor"] != actor:
                raise AccessError("operation_not_found")
            if type(revision) is not int or job["revision"] != revision:
                raise AccessError("revision_conflict")
            if job["state"] == "cancelled" or job["state"] == "completed":
                raise AccessError("job_finished")
            if action in {"resume", "retry_failed"}:
                self._scope_current()
                self._bound_job(job)
                if self._requires_approval(state):
                    job_approval.check(job, action=action)
                if job["rules"] != self._creation.manager.bulk.rules_stamp():
                    raise AccessError("bulk_review_stale")
                if action == "retry_failed":
                    for row in job["rows"]:
                        if row["state"] == "failed":
                            row.update(state="pending", error=None)
                job["state"] = "running"
            elif action == "pause":
                job["state"] = "paused"
            else:
                job["state"] = "cancelled"
                job.pop("approval", None)
                for row in job["rows"]:
                    row["change"] = {}
            job["revision"] += 1
            job["updated_at"] = utc_now()
            return self.public(job)

        if action in {"resume", "retry_failed"}:
            with source_commit(self._creation.repository, self._scope_current):
                result = await self._creation.repository._commit(apply)
        else:
            result = await self._creation.repository._commit(apply)
        self._check_owner()
        o = self._creation
        if result["state"] == "running" and not any(
            key == identity and not task.done() for task, key in tuple(o.active.items())
        ):
            if identity in self._bridge_grants:
                # A new native worker receives only its independently admitted
                # job grant. Do not copy commandTTL/commit scopes or authorship.
                task = asyncio.create_task(CheckpointJobs.run(self, identity), context=Context())
            else:
                task = asyncio.create_task(CheckpointJobs.run(self, identity))
            self._bind_task(task, identity)
        self._creation.manager._changed()
        return result

    async def run(self, identity: str) -> None:
        self._check_owner()
        o = self._creation
        task = asyncio.current_task()
        self._bind_task(task, identity)
        marker = _worker_owners.set((*_worker_owners.get(), (o, task)))
        grant = self._bridge_grants.get(identity)
        execution = _bridge_worker.set((o, task, identity, grant) if grant is not None else None)
        try:
            async with o.workers:
                self._check_owner()
                await CheckpointJobs._run(self, identity)
        finally:
            _bridge_worker.reset(execution)
            _worker_owners.reset(marker)

    async def _run(self, identity: str) -> None:
        o = self._creation
        repository = self._creation.repository
        try:
            while not o.life[0]:
                self._worker_current()
                job = repository._state["checkpoint_jobs"][identity]
                self._bound_job(job)
                if job["state"] != "running":
                    return
                if not await self._allowed(job["actor"], worker=True):
                    await self._pause(identity)
                    return
                if self._requires_approval(repository._state):
                    try:
                        approver = job_approval.check(job)
                        if not await self._allowed(approver):
                            raise AccessError("approval_required")
                    except AccessError:
                        await self._pause(identity)
                        return
                row = next((row for row in job["rows"] if row["state"] == "pending"), None)
                if row is None:

                    def finish(state: dict[str, Any]) -> None:
                        current = state["checkpoint_jobs"][identity]
                        if current["state"] == "running":
                            current["state"] = (
                                "completed_with_errors"
                                if any(row["state"] == "failed" for row in current["rows"])
                                else "completed"
                            )
                            current["revision"] += 1
                            current["updated_at"] = utc_now()

                    await repository._commit(finish)
                    return
                index = row["index"] - 1
                targets: set[str] = set()

                def apply(
                    state: dict[str, Any], index: int = index, targets: set[str] = targets
                ) -> None:
                    self._worker_current()
                    self._scope_current()
                    current = state["checkpoint_jobs"][identity]
                    self._bound_job(current)
                    if current["state"] != "running":
                        raise AccessError("job_paused")
                    if current["rules"] != self._creation.manager.bulk.rules_stamp():
                        raise AccessError("bulk_review_stale")
                    record = current["rows"][index]
                    if self._requires_approval(state):
                        job_approval.check(current, row=record)
                    change = record["change"]
                    uid = change["user_id"]
                    old, user = None, None
                    if uid:
                        old = repository.get(uid)
                        targets.update(old.assignments)
                        targets.update(
                            sid for sid, bindings in state["bindings"].items() if uid in bindings
                        )
                        for collection in ("retired_cards", "retired_pins"):
                            targets.update(
                                sid
                                for item in state[collection].values()
                                if item["user_id"] == uid
                                for sid in item["targets"]
                            )
                    if change.get("delete"):
                        repository._delete_user(state, uid, change["revision"])
                    else:
                        user = repository._bulk_users(state, [change])[0]
                        if not uid or desired_fields(old) != desired_fields(user):
                            validate_csv_targets(user, self._creation.manager._csv_rules())
                        targets.update(user.assignments)
                    row_guard = self._creation.ports[8]
                    evidence = row_guard(deepcopy(change), old, user) if row_guard else None
                    if self._creation.ports[10] is not None:
                        checkpoint_peer_binding.append(
                            state, current, index + 1, evidence, old, user
                        )
                    elif evidence is not None:
                        raise AccessError("unauthorized")
                    self._scope_current()
                    record.update(state="saved", error=None, change={})
                    current["revision"] += 1
                    current["updated_at"] = utc_now()

                try:
                    with audit_actor(
                        job["actor"],
                        f"job/{job['kind']}",
                        value_free=(
                            o.ports[11] is not None or self._bridge_execution() is not None
                        ),
                    ):
                        if self._creation.ports[7] is None and self._bridge_execution() is None:
                            await repository._commit(apply, offload=True)
                        else:
                            with source_commit(repository, self._scope_current):
                                await repository._commit(apply, offload=True)
                except AccessError as error:
                    code = str(error)
                    if code in {
                        "job_paused",
                        "bulk_review_stale",
                        "approval_required",
                        "approval_expired",
                    }:
                        await self._pause(identity)
                        return
                    safe = code if re.fullmatch(r"[a-z_]{1,64}", code) else "operation_failed"

                    def failed(state: dict[str, Any], index: int = index, safe: str = safe) -> None:
                        current = state["checkpoint_jobs"][identity]
                        if current["state"] == "cancelled":
                            return
                        current["rows"][index].update(state="failed", error=safe)
                        current["revision"] += 1
                        current["updated_at"] = utc_now()

                    await repository._commit(failed)
                finally:
                    # Include retired credentials and tombstones, even after cancellation.
                    saved_row = repository._state["checkpoint_jobs"][identity]["rows"][index]
                    if saved_row["state"] == "saved":
                        for sid in targets:
                            if sid in self._creation.manager.stations:
                                o.ports[1](sid)
                    o.ports[0]()
                await asyncio.sleep(0)
        except asyncio.CancelledError:
            raise
        except Exception:
            # Persistence failure halts writes; do not misclassify it as a row failure.
            try:
                await self._pause(identity)
            except Exception:
                pass
        finally:
            o.ports[0]()

    async def _pause(self, identity: str) -> None:
        def apply(state: dict[str, Any]) -> None:
            job = state["checkpoint_jobs"][identity]
            if job["state"] == "running":
                job["state"] = "paused"
                job["revision"] += 1
                job["updated_at"] = utc_now()

        await self._creation.repository._commit(apply)

    def error_csv(self, actor: str, identity: str) -> str:
        self._check_owner(closed_ok=True)
        job = self._creation.repository._state["checkpoint_jobs"].get(identity)
        if not job or job["actor"] != actor:
            raise AccessError("operation_not_found")
        out = io.StringIO()
        writer = csv.writer(out)
        writer.writerow(["row", "state", "error"])
        for row in job["rows"]:
            if row["state"] == "failed":
                writer.writerow([row["source_line"], row["state"], row["error"]])
        return out.getvalue()

    async def close(self) -> None:
        o = self._creation
        o.life[0] = self.closed = True
        if o.life[1] is None:
            tasks = tuple(o.active)

            async def finish() -> None:
                for task in tasks:
                    task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)

            o.life[1] = asyncio.create_task(finish())
        caller = asyncio.current_task()
        # A worker's save callback cannot join the worker that is awaiting it.
        # This ancestry only defers the join; it grants no mutation authority.
        if caller in o.active or any(
            owner is o and not task.done() for owner, task in _worker_owners.get()
        ):
            return
        cancelled = False
        while not o.life[1].done():
            try:
                await asyncio.shield(o.life[1])
            except asyncio.CancelledError:
                cancelled = True
        o.life[1].result()
        self._bridge_grants.clear()
        if cancelled:
            raise asyncio.CancelledError
