"""EXTERNALBUILD-297 (slice X5): the service-writer adapter of the external-access grant engine on WisKey's DIRECT connection.

Why it exists. The grant worker (services/access_grants.py `Worker`) is a background process that acts as `system:access_grants`. WisKey's
published native people-write contract (`wiskey-native-bridge-write.v1`, services/wiskey_native_write.py) admits only a HUMAN actor in an
active interactive session, so the worker cannot write natively today. Slice X2 makes the engine fall back to the local service channel
(services/access_grant_engine.py `WiskeyServiceEngine._write`) whenever the direct connection is selected and no service writer is
available. This module is the ONE place where the direct service write will be wired once WisKey publishes a service-actor contract:
only `DirectServiceWriter._wire` has to be filled in (and `WIRE_BUILT` set); the engine, the worker, the readiness check and the tests
already go through the `ServiceWriter` port below.

The contract Arx EXPECTS (PROPOSED by Arx, not published by WisKey, NOT_RUN against any WisKey; docs/changes/EXTERNALBUILD-297.md section 5
has the full text to send to WisKey):
- discovery: `direct/capabilities` lists the capability `SERVICE_CAPABILITY` and the command `SERVICE_COMMAND` on the authenticated
  direct connection (the join's selection rule, `DirectJoin.selected(SERVICE_COMMAND)`);
- one signed command `SERVICE_COMMAND` carrying `{action, target: {user_id?, expected_revision?}, data, attribution}`, where `action` is one
  of `ACTIONS` (the same business shapes the service channel sends today: services/access_grant_engine.py `create_payload`,
  `apply_payload`, `strip_payload`, `station_access_payload`, the rename and card payloads) and `attribution` is `Attribution.as_wire()`:
  the service actor (`arx-service:<entry>`), the grant reference and the HUMAN approver's Arx RBAC decision (who approved, at which
  permission revision) - Arx RBAC stays the only authority (AUTH01), WisKey records who decided;
- the answer: `{ok: true, person: <ManagedUser.public>}` (`users/delete`: `{ok: true}`), or an error with WisKey's code and whether the
  write may have happened (`outcome`: `not_sent` | `unknown` | `refused`), mapped here to the engine's closed error kinds;
- an UNKNOWN outcome is never re-sent: the engine's existing rule applies (the next step is a fresh `users/get`).

Nothing here sends anything while `WIRE_BUILT` is False: `available()` is then False and the engine uses the service channel. Tests drive
the adapter with a fake wire (tests/test_externalbuild_297.py); nothing in this module reaches WisKey, a station or a door.
"""
from __future__ import annotations

import contextlib
import contextvars
import logging
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Iterator, Mapping, Protocol

from .access_grant_engine import EngineError

log = logging.getLogger("smplwise.access_service_writer")

CONTRACT = "wiskey-native-service-write.v1"  # WisKey kept the name; its FINAL wire differs from this proposal (services/wiskey_service_write.py)
SERVICE_COMMAND = "users/service_write_v1"   # Arx's PROPOSED single command - SUPERSEDED (WISKEY-MAC-ADOPT-298): WisKey adds `service_write`
                                             # metadata to four existing commands instead; this command does not exist on WisKey's side
SERVICE_CAPABILITY = "native_service_actor_write_v1"
ACTIONS = frozenset({"users/create", "users/update", "users/delete", "cards/add", "cards/remove"})
SERVICE_ACTOR_PREFIX = "arx-service:"
OUTCOMES = ("not_sent", "unknown", "refused")

# The wire to WisKey is not built: WisKey has not published the service-actor contract (board: "WisKey: waiting for their side").
# Set to True only by the commit that implements `DirectServiceWriter._wire` against the published contract.
WIRE_BUILT = False


# ---------------------------------------------------------------- attribution (who decided, carried with every service write)

@dataclass(frozen=True)
class Attribution:
    """The human decision behind a background write: the grant it serves and the approver's Arx RBAC decision. Ids only - never a
    name, a phone or a PIN."""

    grant_ref: str | None = None
    approved_by: str | None = None
    approval_revision: int | None = None
    reason: str | None = None  # provision | narrow | code | revoke | rename | card

    def as_wire(self, service_actor: str) -> dict[str, Any]:
        out: dict[str, Any] = {"service_actor": service_actor, "decided_by": "arx_rbac"}
        if self.grant_ref:
            out["grant_ref"] = self.grant_ref[:64]
        if self.approved_by:
            out["approved_by"] = self.approved_by[:128]
        if isinstance(self.approval_revision, int) and not isinstance(self.approval_revision, bool):
            out["approval_revision"] = self.approval_revision
        if self.reason:
            out["reason"] = self.reason[:32]
        return out


_CURRENT: contextvars.ContextVar[Attribution | None] = contextvars.ContextVar("access_service_attribution", default=None)


@contextlib.contextmanager
def attributed(grant: Mapping[str, Any] | None, reason: str | None = None) -> Iterator[None]:
    """The worker wraps each grant's engine calls in this: a service write made inside carries the grant and its approver."""
    attr = None
    if grant:
        attr = Attribution(grant_ref=str(grant.get("id") or "")[:64] or None, approved_by=grant.get("approved_by") or None,
                           approval_revision=grant.get("approval_revision"), reason=reason)
    token = _CURRENT.set(attr)
    try:
        yield
    finally:
        _CURRENT.reset(token)


def current_attribution() -> Attribution:
    return _CURRENT.get() or Attribution()


# ---------------------------------------------------------------- the port

@dataclass(frozen=True)
class ServiceWrite:
    """One people write as the engine means it (the business shape is the service channel's, unchanged)."""

    action: str
    data: dict[str, Any] = field(default_factory=dict)
    person_id: str | None = None
    revision: int | None = None
    attribution: Attribution = field(default_factory=Attribution)

    def check(self) -> None:
        if self.action not in ACTIONS:
            raise EngineError("not_sent", "service_action_unsupported")
        if self.action != "users/create" and (not isinstance(self.person_id, str) or not self.person_id):
            raise EngineError("not_sent", "service_target_missing")
        if self.action != "users/create" and (not isinstance(self.revision, int) or isinstance(self.revision, bool) or self.revision < 1):
            raise EngineError("not_sent", "service_revision_missing")
        if not isinstance(self.data, dict):
            raise EngineError("not_sent", "service_data_invalid")


class ServiceWriter(Protocol):
    def available(self) -> bool:
        """True only when the contract is negotiated on the current connection AND the wire is built. Never raises."""
        ...

    def write(self, op: ServiceWrite) -> dict[str, Any]:
        """Send ONE write. Returns the raw person record (`{}` for users/delete). Raises EngineError with the engine's closed kinds."""
        ...


class ServiceWireError(Exception):
    """What a wire raises: WisKey's code and whether the write may have happened."""

    def __init__(self, code: str, outcome: str = "unknown") -> None:
        super().__init__(code)
        self.code = (code or "")[:64]
        self.outcome = outcome if outcome in OUTCOMES else "unknown"


Wire = Callable[[dict[str, Any]], Any]


def frame(op: ServiceWrite, service_actor: str) -> dict[str, Any]:
    """The parameters of one `SERVICE_COMMAND` (the shape Arx proposes to WisKey). The PIN, when the action carries one, exists only
    in `data` inside this frame and the call that sends it."""
    target: dict[str, Any] = {}
    if op.person_id is not None:
        target["user_id"] = op.person_id
    if op.revision is not None:
        target["expected_revision"] = op.revision
    return {"contract": CONTRACT, "action": op.action, "target": target, "data": op.data, "attribution": op.attribution.as_wire(service_actor)}


def map_wire_error(exc: ServiceWireError) -> EngineError:
    code = exc.code
    if code in ("user_not_found", "intercom_person_not_found"):
        return EngineError("not_found", code)
    if code == "revision_conflict":
        return EngineError("revision_conflict", code)
    if code == "pin_conflict":
        return EngineError("pin_conflict", code)
    if exc.outcome == "not_sent":
        return EngineError("not_sent", code)
    if exc.outcome == "refused":
        return EngineError("refused", code)
    return EngineError("unknown", code)


class DirectServiceWriter:
    """The adapter over the direct connection. `selected(command)` is the join's selection rule (auto + key + socket + discovery lists
    the command); `wire` sends one frame and returns WisKey's answer. Production builds it with `from_join`; tests give a fake wire."""

    def __init__(self, *, selected: Callable[[str], bool], wire: Wire | None, service_actor: str = SERVICE_ACTOR_PREFIX + "access_grants",
                 wire_built: Callable[[], bool] | None = None) -> None:
        self._selected = selected
        self._wire = wire
        self.service_actor = service_actor
        self._wire_built = wire_built or (lambda: WIRE_BUILT)

    @classmethod
    def from_join(cls, join: Any) -> "DirectServiceWriter":
        """The live adapter over an installed `wiskey_direct_join.DirectJoin`. Its wire is NOT built (no published contract): while
        `WIRE_BUILT` is False `available()` is False and nothing is sent."""
        entry = getattr(getattr(join, "session", None), "entry_id", None) or "access_grants"
        return cls(selected=lambda command: bool(join.selected(command)), wire=None, service_actor=SERVICE_ACTOR_PREFIX + str(entry)[:64])

    def available(self) -> bool:
        try:
            return bool(self._wire_built()) and self._wire is not None and bool(self._selected(SERVICE_COMMAND))
        except Exception:  # noqa: BLE001 - "cannot tell" is "not available": the engine uses the service channel
            return False

    def write(self, op: ServiceWrite) -> dict[str, Any]:
        op.check()
        if not self.available():
            raise EngineError("not_sent", "service_writer_unavailable")
        payload = frame(op, self.service_actor)
        try:
            answer = self._wire(payload)  # type: ignore[misc]
        except ServiceWireError as exc:
            raise map_wire_error(exc) from None
        except EngineError:
            raise
        except Exception as exc:  # noqa: BLE001 - a transport failure after the frame left: the outcome is unknown
            raise EngineError("unknown", type(exc).__name__) from None
        finally:
            payload.clear()  # drop the frame (and any PIN in it) with the call
        if not isinstance(answer, Mapping) or answer.get("ok") is not True:
            raise EngineError("unknown", "invalid_response")
        if op.action == "users/delete":
            return {}
        person = answer.get("person")
        if not isinstance(person, dict):
            raise EngineError("unknown", "invalid_response")
        return person


# ---------------------------------------------------------------- process state (tests install a fake; production: nothing until the wire exists)

_LOCK = threading.Lock()
WRITER: ServiceWriter | None = None


def install(writer: ServiceWriter | None) -> None:
    global WRITER
    with _LOCK:
        WRITER = writer


def writer_for(join: Any) -> ServiceWriter | None:
    """The writer the engine may use NOW on the selected direct connection, or None (-> the service channel). Never raises."""
    w = WRITER
    if w is None and join is not None:
        try:
            # WISKEY-MAC-ADOPT-298 item C: WisKey's FINAL contract (services/wiskey_service_write.py) replaces Arx's proposal above. It is
            # wired here, but it is available only once the OWNER's grant reference is configured (OWNER-CONFIG) - until then None.
            from .wiskey_service_write import FinalServiceWriter

            w = FinalServiceWriter.from_join(join)
        except Exception:  # noqa: BLE001
            w = None
    try:
        return w if w is not None and w.available() else None
    except Exception:  # noqa: BLE001
        return None


# ---------------------------------------------------------------- the last path the engine took (read by the readiness check)

@dataclass
class PathRecord:
    path: str | None = None      # service_channel | direct_service_writer
    reason: str | None = None    # why this path: provider_local | direct_not_selected | direct_service_writer | direct_service_writer_missing
    at: str | None = None
    writes: int = 0
    fallbacks: int = 0


LAST = PathRecord()


def record(path: str, reason: str) -> None:
    with _LOCK:
        LAST.path, LAST.reason = path, reason
        LAST.at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        LAST.writes += 1
        if reason == "direct_service_writer_missing":
            LAST.fallbacks += 1
    if reason == "direct_service_writer_missing":
        log.info("access grants: the direct connection cannot take a service write yet - this write used the local service channel")


def last_path() -> dict[str, Any]:
    with _LOCK:
        return {"path": LAST.path, "reason": LAST.reason, "at": LAST.at, "writes": LAST.writes, "fallbacks": LAST.fallbacks}


def reset_for_tests() -> None:
    global LAST
    install(None)
    with _LOCK:
        LAST = PathRecord()
