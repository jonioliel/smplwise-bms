"""Original paired-bridge authority for one explicitly resumed native row job.

No actor-string/admin lookup, reconstructed permission or stored command body.
Only public origin IDs persist; restart loads jobs paused and needs fresh source
admission. An admitted worker has its own finite1h window and original source.
"""

from __future__ import annotations

import asyncio
import re
import weakref
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any

from .access.models import AccessError
from .bridge_command_scope import _SCOPE
from .const import DOMAIN
from .trusted_actions.validation import Refusal

if TYPE_CHECKING:
    from .access.checkpoint_jobs import CheckpointJobs
    from .bridge_command_auth import BridgeExecutionBinding, VerifiedBridgePrincipal

type _CheckpointRecord = tuple[
    weakref.ReferenceType["CheckpointJobs"], "BridgeExecutionBinding", str, str, dict[str, Any]
]
_GRANTS: weakref.WeakKeyDictionary[NativeCheckpointGrant, _CheckpointRecord] = (
    weakref.WeakKeyDictionary()
)
EXECUTION_SECONDS = 3600


def validate_origin(value: Any) -> None:
    if (
        type(value) is not dict
        or set(value) != {"version", "entry_id", "query_owner_id"}
        or type(value["version"]) is not int
        or value["version"] != 1
        or type(value["entry_id"]) is not str
        or re.fullmatch(r"[A-Za-z0-9_-]{1,128}", value["entry_id"]) is None
        or type(value["query_owner_id"]) is not str
        or (
            re.fullmatch(r"[0-9a-f]{32}", value["query_owner_id"]) is None
            and value["query_owner_id"] != "arx-service:" + value["entry_id"]
        )
    ):
        raise AccessError("invalid_storage")


def command_principal(actor: str) -> VerifiedBridgePrincipal | None:
    """Only the active original command Task may admit a new job or resume."""
    scope = _SCOPE.get()
    if scope is None:
        return None
    if not scope.active or scope.task is not asyncio.current_task():
        raise AccessError("unauthorized")
    from .bridge_command_auth import VerifiedBridgePrincipal

    principal = scope.principal
    try:
        if type(principal) is not VerifiedBridgePrincipal or principal.actor_id != actor:
            raise Refusal("Unauthorized")
        principal.check()
    except Refusal:
        raise AccessError("unauthorized") from None
    return principal


def origin(principal: VerifiedBridgePrincipal) -> dict[str, Any]:
    _epoch, entry_id, user, _connection = principal.owner_key
    value = {"version": 1, "entry_id": entry_id, "query_owner_id": user.id}
    validate_origin(value)
    return value


def require_job_origin(principal: VerifiedBridgePrincipal, job: dict[str, Any]) -> None:
    if job.get("bridge_owner") != origin(principal) or job.get("actor") != principal.actor_id:
        raise AccessError("unauthorized")


class NativeCheckpointGrant:
    __slots__ = ("__weakref__",)

    @classmethod
    def issue(
        cls, jobs: CheckpointJobs, principal: VerifiedBridgePrincipal, actor: str, identity: str
    ) -> NativeCheckpointGrant:
        from .access.checkpoint_jobs import CheckpointJobs
        from .bridge_command_auth import VerifiedBridgePrincipal, retain_execution

        if (
            cls is not NativeCheckpointGrant
            or type(jobs) is not CheckpointJobs
            or type(principal) is not VerifiedBridgePrincipal
            or principal.command not in {"jobs/bulk_create", "jobs/csv_create", "jobs/action"}
            or principal.actor_id != actor
            or principal.repository is not jobs._creation.repository
        ):
            raise AccessError("unauthorized")
        jobs._check_owner()
        owner = origin(principal)
        execution = retain_execution(
            principal, datetime.now(UTC) + timedelta(seconds=EXECUTION_SECONDS)
        )
        grant = cls()
        _GRANTS[grant] = weakref.ref(jobs), execution, identity, actor, owner
        grant._origin(jobs)
        return grant

    def _origin(self, jobs: CheckpointJobs) -> _CheckpointRecord:
        record = _GRANTS.get(self) if type(self) is NativeCheckpointGrant else None
        if record is None or record[0]() is not jobs:
            raise AccessError("unauthorized")
        try:
            jobs._check_owner()
            repository = record[1].check()
            _epoch, _entry_id, _user, connection = record[1].owner_key
            if (
                repository is not jobs._creation.repository
                or connection.hass.data[DOMAIN].get("checkpoint_jobs") is not jobs
            ):
                raise Refusal("Unauthorized")
        except Refusal:
            raise AccessError("unauthorized") from None
        return record

    def metadata(self, jobs: CheckpointJobs) -> dict[str, Any]:
        return dict(self._origin(jobs)[4])

    def check(self, jobs: CheckpointJobs, identity: str, actor: str | None = None) -> None:
        record = self._origin(jobs)
        job = jobs._creation.repository._state["checkpoint_jobs"].get(identity)
        if (
            identity != record[2]
            or actor is not None
            and actor != record[3]
            or job is None
            or job.get("actor") != record[3]
            or job.get("bridge_owner") != record[4]
        ):
            raise AccessError("unauthorized")
