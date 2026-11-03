"""OFF native source composition with durable registry and one native commit.

The host supplies the actual authenticated PeerMessage and already admitted
current EngineContext. Test verifier/source callbacks prove this WisKey half
only. There is no default authenticator, peer fabrication, route registration,
principal creation, automatic retry or production storage migration.
"""

from __future__ import annotations

import asyncio
from copy import deepcopy
from dataclasses import dataclass
from typing import Any

from ..access import native_peer_storage as storage
from ..access.repository import AccessRepository
from .adapters import EngineContext
from .envelope import Request, freeze, thaw
from .legacy_capture import LegacyCaptureReceiver
from .peer_boundary import PeerMessage, peer_revision
from .source_bindings import same_ports
from .source_commit_guard import source_commit
from .source_mutations import SourceUserMutations
from .validation import Refusal, reference


class NativePeerRegistry:
    """Owner-provisioned registry in the same actual native repository image.

    Provision/history methods are owner construction operations, not peer APIs.
    Binding versions are immutable except explicit historical-read grants.
    A current transport is still mandatory for every historical lookup.
    """

    def __init__(self, repository: AccessRepository, *, repository_id: str) -> None:
        if type(repository) is not AccessRepository or repository._peer_receipts is not True:
            raise ValueError("explicit native schema 17 candidate repository required")
        self.repository, self.repository_id = repository, reference(repository_id)
        self._roots = repository, repository_id, repository._save, repository._lock

    def _stable(self) -> dict[str, Any]:
        repository, identity, save, lock = self._roots
        if (
            self.repository is not repository
            or self.repository_id != identity
            or repository._save is not save
            or repository._lock is not lock
            or repository._peer_receipts is not True
            or repository._state.get("schema") != 17
            or repository._state["peer_source"]["receipt_limit"] != repository._peer_receipt_limit
        ):
            raise Refusal("binding_denied")
        table = repository._state["peer_source"]
        if table["repository_id"] not in (None, identity):
            raise Refusal("binding_denied")
        return table

    async def provision(
        self,
        binding_ref: str,
        *,
        expected_revision: int,
        verified_peer_ref: str,
        query_owner_id: str,
        active: bool,
        historical_read: bool = False,
        transport_entry_id: str | None = None,
    ) -> int:
        NativePeerRegistry._stable(self)
        for value in (binding_ref, verified_peer_ref, query_owner_id):
            reference(value)
        peer_revision(expected_revision, zero=True)
        revision = peer_revision(expected_revision + 1)
        if transport_entry_id is not None:
            reference(transport_entry_id)
        if type(active) is not bool or type(historical_read) is not bool:
            raise ValueError("explicit registry state required")

        def change(state):
            table = state["peer_source"]
            if table["repository_id"] not in (None, self._roots[1]):
                raise Refusal("binding_denied")
            if table["heads"].get(binding_ref, 0) != expected_revision:
                raise Refusal("binding_denied")
            table["repository_id"] = self._roots[1]
            table["heads"][binding_ref] = revision
            table["versions"].setdefault(binding_ref, {})[str(revision)] = {
                "verified_peer_ref": verified_peer_ref,
                "query_owner_id": query_owner_id,
                "active": active,
                "historical_read": historical_read,
            }
            if transport_entry_id is not None:
                table["versions"][binding_ref][str(revision)].update(
                    read_scope="central_capture_person_commit",
                    transport_entry_id=transport_entry_id,
                )
            storage.validate(table)
            return revision

        return await self._roots[0]._commit(change)

    async def historical_permission(
        self, binding_ref: str, revision: int, *, allowed: bool
    ) -> None:
        NativePeerRegistry._stable(self)
        reference(binding_ref)
        peer_revision(revision)
        if type(allowed) is not bool:
            raise ValueError("explicit history grant required")

        def change(state):
            row = state["peer_source"]["versions"].get(binding_ref, {}).get(str(revision))
            if row is None:
                raise Refusal("binding_denied")
            row["historical_read"] = allowed
            storage.validate(state["peer_source"])

        await self._roots[0]._commit(change)

    def check(self, message: PeerMessage, *, original: dict | None = None):
        table = NativePeerRegistry._stable(self)
        if type(message) is not PeerMessage or type(message.request) is not Request:
            raise Refusal("Unauthorized")
        message.check()
        verified = message.verification
        row = (
            table["versions"]
            .get(verified.peer_binding_ref, {})
            .get(str(verified.peer_binding_revision))
        )
        if (
            verified.repository_id != self._roots[1]
            or row is None
            or row["verified_peer_ref"] != verified.verified_peer_ref
            or row["query_owner_id"] != message.query_owner_id
            or table["heads"].get(verified.peer_binding_ref) != verified.peer_binding_revision
            or row["active"] is not True
            # A paired read service never becomes a W1 mutation principal.
            or "read_scope" in row
        ):
            raise Refusal("binding_denied")
        if original is not None:
            storage.validate_original(original)
            history = (
                table["versions"]
                .get(original["peer_binding_ref"], {})
                .get(str(original["peer_binding_revision"]))
            )
            if (
                original["repository_id"] != self._roots[1]
                or original["verified_peer_ref"] != verified.verified_peer_ref
                or original["query_owner_id"] != message.query_owner_id
                or history is None
                or history["verified_peer_ref"] != original["verified_peer_ref"]
                or history["query_owner_id"] != original["query_owner_id"]
                or history["historical_read"] is not True
            ):
                raise Refusal("binding_denied")
        message.check()
        if NativePeerRegistry._stable(self) is not table:
            raise Refusal("binding_denied")

    def lookup(self, binding_ref: str, revision: int, *, query_owner_id: str) -> dict:
        """Exact Arx draft1 public row; no automatic following of a rotation."""
        reference(binding_ref)
        reference(query_owner_id)
        peer_revision(revision)
        table = NativePeerRegistry._stable(self)
        history = table["versions"].get(binding_ref, {})
        row = history.get(str(revision))
        head = table["heads"].get(binding_ref)
        if row is None or row["query_owner_id"] != query_owner_id:
            raise Refusal("binding_denied")
        peer_revision(head)
        successors = sorted(peer_revision(int(value)) for value in history if int(value) > revision)
        successor = None
        if successors and row["active"] is True:
            state = "rotated"
            successor = {"peer_binding_ref": binding_ref, "peer_binding_revision": successors[0]}
        else:
            state = "active" if revision == head and row["active"] is True else "revoked"
        result = {
            "schema_version": 1,
            "protocol": "wiskey-peer-binding-draft1",
            "verified_peer_ref": row["verified_peer_ref"],
            "peer_binding_ref": binding_ref,
            "peer_binding_revision": revision,
            "query_owner_id": query_owner_id,
            "repository_id": self._roots[1],
            "allowed_read_scope": "central_capture_person_commit",
            "state": state,
            "active": state == "active",
            "historical_read": row["historical_read"],
            "successor": successor,
        }
        if NativePeerRegistry._stable(self) is not table:
            raise Refusal("binding_denied")
        return deepcopy(result)


@dataclass(frozen=True, repr=False)
class _CaptureBirth:
    session_id: str
    original: object
    context: EngineContext
    receiver: LegacyCaptureReceiver
    source_session: object


class NativePeerSource:
    def __init__(
        self,
        registry: NativePeerRegistry,
        *,
        mutations: SourceUserMutations | None = None,
        capture: LegacyCaptureReceiver | None = None,
        original_create=None,
    ):
        if type(registry) is not NativePeerRegistry:
            raise ValueError("explicit native peer registry required")
        if mutations is not None and (
            type(mutations) is not SourceUserMutations
            or mutations.repository is not registry.repository
        ):
            raise ValueError("same actual native source receiver required")
        if capture is not None and (
            type(capture) is not LegacyCaptureReceiver
            or capture._source_manager.repository is not registry.repository
            or capture._completion is None
        ):
            raise ValueError("same owned native capture completion required")
        if not callable(original_create):
            raise ValueError("trusted current source original-create provider required")
        self.registry, self.mutations, self.capture = registry, mutations, capture
        self.original_create = original_create
        self.closed = False
        self._births = {}
        self._capture_issued = {}
        self._roots = (
            registry,
            mutations,
            capture,
            original_create,
            self._births,
            self._capture_issued,
        )
        self._ports = (
            registry.check,
            getattr(mutations, "apply", None),
            getattr(capture, "execute", None),
        )

    def _stable(self):
        if (
            self.closed
            or not same_ports(
                self._roots,
                (
                    self.registry,
                    self.mutations,
                    self.capture,
                    self.original_create,
                    self._births,
                    self._capture_issued,
                ),
            )
            or not same_ports(
                self._ports,
                (
                    self.registry.check,
                    getattr(self.mutations, "apply", None),
                    getattr(self.capture, "execute", None),
                ),
            )
        ):
            raise Refusal("binding_denied")

    def _current(self, message, context):
        self._stable()
        if (
            type(context) is not EngineContext
            or context.request is not message.request
            or context.parameters is None
            or context.epoch is None
        ):
            raise Refusal("binding_denied")
        context.check()
        self.registry.check(message)
        self._stable()
        context.check()

    def resolve(self, message: PeerMessage, context: EngineContext, original: dict) -> dict | None:
        """Fresh current source plus explicit owner history permission; read only.

        A caller must give the complete original peer/descriptor references.
        Missing originals return unknown (None), never recover by person fields.
        """
        self._current(message, context)
        self.registry.check(message, original=original)
        result = storage.find(self.registry.repository._state["peer_source"], original)
        # This narrow internal read uses the already authorized native person
        # scope. Unknown-create recovery needs a separately reviewed status
        # contract; it cannot borrow an unrelated person's users/get context.
        if (
            context.request.get("action") != "users/get"
            or result is not None
            and context.parameters.get("user_id") != result["user_id"]
        ):
            raise Refusal("binding_denied")
        self._current(message, context)
        self.registry.check(message, original=original)
        return result

    async def execute_user(self, message: PeerMessage, context: EngineContext):
        self._current(message, context)
        if self.mutations is None:
            raise Refusal("binding_denied")
        action = message.request.get("action")
        origin = self.original_create(context) if action == "users/create" else None
        if action == "users/create":
            reference(origin)
        return await self._execute_commit(message, context, self.mutations.apply, origin=origin)

    async def _execute_commit(self, message, context, execute, *, origin=None, capture_birth=None):
        metadata = storage.original(message)
        request, task = context.request, asyncio.current_task()
        attached = [False]

        def current():
            if asyncio.current_task() is not task or context.request is not request:
                raise Refusal("binding_denied")
            self._current(message, context)
            if origin is not None and self.original_create(context) != origin:
                raise Refusal("binding_denied")
            if capture_birth is not None:
                self._check_capture(capture_birth, message, context)

        def attachment(before, candidate, result):
            current()
            if attached[0]:
                return
            storage.attach(
                before,
                candidate,
                result,
                metadata=metadata,
                source_epoch=context.epoch,
                create_origin=origin,
                capture_original=thaw(capture_birth.original)
                if capture_birth is not None
                else None,
            )
            attached[0] = True
            current()

        scoped = EngineContext.scoped(context, lambda _: (current(), True)[1])
        scoped.trace = context.trace
        with source_commit(self.registry.repository, current, attachment=attachment):
            result = await execute(message.request.get("action"), scoped.parameters, scoped)
        current()
        if not attached[0]:
            raise Refusal("native_commit_not_observed")
        return result

    def _check_capture(self, birth, message, context):
        self._current(message, context)
        if (
            type(birth) is not _CaptureBirth
            or self._births.get(birth.session_id) is not birth
            or birth.receiver is not self.capture
            or birth.context.epoch != context.epoch
            or context.parameters.get("session_id") != birth.session_id
        ):
            raise Refusal("binding_denied")
        issued = self._capture_issued.get(id(birth))
        if (
            issued is None
            or issued[0] is not birth
            or not same_ports(
                issued[1],
                (
                    birth.session_id,
                    birth.original,
                    birth.context,
                    birth.receiver,
                    birth.source_session,
                ),
            )
        ):
            raise Refusal("binding_denied")
        row = birth.receiver._source_sessions.get(birth.session_id)
        # Native confirmation may already have detached its original row. A
        # present successor is never adopted by this independent peer birth.
        if row is not None and row is not birth.source_session:
            raise Refusal("binding_denied")
        birth.context.check()
        now = storage.original(message)
        previous = thaw(birth.original)
        if any(now[key] != previous[key] for key in storage.ORIGINAL_FIELDS - {"original"}):
            raise Refusal("binding_denied")
        if now["original"]["actor"] != previous["original"]["actor"]:
            raise Refusal("binding_denied")

    async def execute_capture(self, message: PeerMessage, context: EngineContext):
        self._current(message, context)
        receiver = self.capture
        if receiver is None:
            raise Refusal("binding_denied")
        action = message.request.get("action")
        if action == "cards/capture_start":
            if len(self._births) >= 128:
                raise Refusal("capture_capacity")

            def current(_):
                self._current(message, context)
                return True

            scoped = EngineContext.scoped(context, current)
            result = await receiver.execute(action, scoped.parameters, scoped)
            self._current(message, context)
            sid = reference(result["session_id"])
            row = receiver._source_sessions.get(sid)
            if row is None or sid in self._births:
                raise Refusal("binding_denied")
            birth = self._births[sid] = _CaptureBirth(
                sid, freeze(storage.original(message)), context, receiver, row
            )
            self._capture_issued[id(birth)] = (
                birth,
                (
                    birth.session_id,
                    birth.original,
                    birth.context,
                    birth.receiver,
                    birth.source_session,
                ),
            )
            return result
        sid = reference(context.parameters.get("session_id"))
        birth = self._births.get(sid)
        self._check_capture(birth, message, context)
        try:
            if action == "cards/capture_confirm":
                return await self._execute_commit(
                    message, context, receiver.execute, capture_birth=birth
                )
            if action not in {"cards/capture_status", "cards/capture_cancel"}:
                raise Refusal("binding_denied")
            scoped = EngineContext.scoped(
                context, lambda _: (self._check_capture(birth, message, context), True)[1]
            )
            return await receiver.execute(action, scoped.parameters, scoped)
        finally:
            if action != "cards/capture_status":
                self._births.pop(sid, None)
                self._capture_issued.pop(id(birth), None)

    async def close(self):
        self.closed = True
        self._roots[4].clear()
        self._roots[5].clear()
        if self._roots[2] is not None:
            await self._roots[2].close()
