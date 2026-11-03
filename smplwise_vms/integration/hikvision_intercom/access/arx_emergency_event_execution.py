"""Persistent manual emergency events on original native target/journal/fence.

The local protocol never automatically restores an opening. A current matching
explicit release records its durable precedence before any I/O. Native ACKs and
client ordering do not prove device persistence or physical/network ordering.
"""

from __future__ import annotations

import asyncio
import weakref
from collections.abc import Callable
from copy import deepcopy
from dataclasses import dataclass, field
from functools import partial
from typing import Any

from ..client.emergency_fence import EmergencyDoorFence
from ..trusted_actions.envelope import thaw
from ..trusted_actions.source_bindings import same_ports
from ..trusted_actions.validation import Refusal
from . import arx_emergency_event_contract as contract
from .arx_door_execution import NativeDoorTarget, _primary
from .arx_emergency_event_ledger import EmergencyEventLedger
from .arx_execution_authority import FeatureLease
from .arx_execution_journal import EffectRecord, FeatureExecutionJournal

_OWNERS: weakref.WeakKeyDictionary[EmergencyEventCoordinator, _Owner] = weakref.WeakKeyDictionary()
_TARGET_PORTS = ("check", "description", "inspect_emergency", "emergency")
_TARGET_FUNCTIONS = tuple(getattr(NativeDoorTarget, name) for name in _TARGET_PORTS)


@dataclass(frozen=True, repr=False)
class _Owner:
    lease: FeatureLease
    targets: tuple[NativeDoorTarget, ...]
    journal: FeatureExecutionJournal
    ledger: EmergencyEventLedger
    event: str
    mode: str
    kind: str
    trigger: str
    retry_of: str | None
    startup: Callable[[], None] | None
    target_ports: tuple[tuple[Callable[..., Any], ...], ...]
    record: list[EffectRecord | None] = field(default_factory=lambda: [None])
    stopped: list[bool] = field(default_factory=lambda: [False])
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class EmergencyEventCoordinator:
    def __init__(
        self,
        lease: FeatureLease,
        targets: tuple[NativeDoorTarget, ...],
        journal: FeatureExecutionJournal,
        *,
        startup_guard: Callable[[], None] | None = None,
    ) -> None:
        if (
            type(lease) is not FeatureLease
            or type(journal) is not FeatureExecutionJournal
            or type(targets) is not tuple
            or not 1 <= len(targets) <= 200
            or any(type(target) is not NativeDoorTarget for target in targets)
            or len({(target.grant.station_id, target.grant.physical_relay) for target in targets})
            != len(targets)
            or {target.grant for target in targets} != set(lease.policy.stations)
            or startup_guard is not None
            and not callable(startup_guard)
        ):
            raise Refusal("binding_denied")
        private = thaw(lease.private_input)
        event, mode = contract.request(private)
        kind, trigger, retry = (
            private["kind"],
            private.get("trigger", "manual"),
            private.get("retry_of"),
        )
        ports = tuple(tuple(getattr(target, name) for name in _TARGET_PORTS) for target in targets)
        for target, values in zip(targets, ports, strict=True):
            if any(
                getattr(port, "__self__", None) is not target
                or getattr(port, "__func__", None) is not original
                for port, original in zip(values, _TARGET_FUNCTIONS, strict=True)
            ):
                raise Refusal("binding_denied")
        self.lease, self.targets, self.journal = lease, targets, journal
        self.ledger = EmergencyEventLedger(journal)
        self.event_ref, self.mode, self._startup_guard = event, mode, startup_guard
        self._record: EffectRecord | None = None
        _OWNERS[self] = _Owner(
            lease,
            targets,
            journal,
            self.ledger,
            event,
            mode,
            kind,
            trigger,
            retry,
            startup_guard,
            ports,
        )
        EmergencyEventCoordinator._current(self)

    def _owner(self) -> _Owner:
        owner = _OWNERS.get(self) if type(self) is EmergencyEventCoordinator else None
        if owner is None or (
            self.lease is not owner.lease
            or self.targets is not owner.targets
            or self.journal is not owner.journal
            or self.ledger is not owner.ledger
            or self.event_ref != owner.event
            or self.mode != owner.mode
            or self._startup_guard is not owner.startup
            or self._record is not owner.record[0]
        ):
            raise Refusal("binding_denied")
        return owner

    def _current(self) -> _Owner:
        owner = EmergencyEventCoordinator._owner(self)
        if any(
            not same_ports(ports, tuple(getattr(target, name) for name in _TARGET_PORTS))
            for target, ports in zip(owner.targets, owner.target_ports, strict=True)
        ):
            raise Refusal("binding_denied")
        if owner.stopped[0]:
            raise Refusal("binding_denied")
        if owner.startup is not None:
            owner.startup()
        owner.lease.check()
        actor = owner.lease.message.request.get("actor")
        if owner.kind == contract.KIND_V2 and owner.trigger == "fire":
            if actor["kind"] != "automation":
                raise Refusal("Unauthorized")
        elif actor["kind"] != "human":
            raise Refusal("automatic_emergency_disabled")
        permissions = (
            {"door/emergency_release", "door/restore"}
            if owner.mode == "release"
            else {
                "door/emergency_open",
                "door/hold_open",
                "door/restore",
            }
        )
        for permission in permissions:
            owner.lease.require(permission)
        primary = tuple(
            target
            for target in owner.targets
            if (
                target.grant.station_id == owner.lease.message.request.parameters["station_id"]
                and target.grant.physical_relay == owner.lease.message.request.parameters["relay"]
            )
        )
        if len(primary) != 1:
            raise Refusal("binding_denied")
        _primary(owner.lease, primary[0], "emergency_buttons")
        for target in owner.targets:
            target.check()
        EmergencyEventLedger._owner(owner.ledger)
        if owner.startup is not None:
            owner.startup()
        return owner

    def _claim(self) -> tuple[str, str, str, str]:
        message = EmergencyEventCoordinator._owner(self).lease.message
        return (
            message.verification.verified_peer_ref,
            message.request.get("operation_id"),
            message.request.get("operation_binding_ref"),
            message.request.get("request_id"),
        )

    def _view(
        self, target: NativeDoorTarget
    ) -> dict[str, tuple[dict[str, Any], dict[str, Any]] | None]:
        owner = EmergencyEventCoordinator._owner(self)
        return owner.ledger.view(owner.lease, owner.event, target.description())

    def _guard(self, target: NativeDoorTarget, *, attempted: bool = True) -> None:
        owner = EmergencyEventCoordinator._current(self)
        view = EmergencyEventCoordinator._view(self, target)
        selected = view["apply"] if owner.mode == "hold_open" else view["release"]
        record = owner.record[0]
        if (
            selected is None
            or record is None
            or selected[0]["key"] != record._key
            or attempted
            and selected[1]["phase"] != "attempted"
            or owner.mode == "hold_open"
            and view["release"] is not None
        ):
            raise Refusal("event_released_or_superseded")

    def _phase(self, target: NativeDoorTarget, value: str, *, completion: bool = False) -> None:
        owner = EmergencyEventCoordinator._owner(self)
        record = owner.record[0]
        if record is None:
            raise Refusal("binding_denied")
        old = owner.journal.read(record)
        changed = deepcopy(old["body"])
        changed["targets"][target.key]["phase"] = value
        owner.journal.save(record, old["revision"], changed, completion=completion)

    def _body(self) -> dict[str, Any]:
        owner = EmergencyEventCoordinator._current(self)
        targets: dict[str, Any] = {}
        own_key = (
            owner.lease.message.verification.verified_peer_ref,
            owner.lease.message.request.get("operation_id"),
        )
        for target in owner.targets:
            view = EmergencyEventCoordinator._view(self, target)
            existing = view["apply"] if owner.mode == "hold_open" else view["release"]
            if existing is not None and existing[0]["key"] == own_key:
                stored: dict[str, Any] = existing[0]["body"]
                if stored["command"] != owner.mode or stored["event_ref"] != owner.event:
                    raise Refusal("operation_conflict")
                return deepcopy(stored)
            apply, released = view["apply"], view["release"]
            for previous in (apply, released):
                if (
                    previous is not None
                    and contract.signature(previous[1]["target"]) != target._values
                ):
                    raise Refusal("event_mapping_conflict")
            retry = owner.retry_of is not None and owner.mode == "hold_open" and released is None
            if retry and (
                apply is None
                or apply[0]["key"][1] != owner.retry_of
                or not EmergencyEventLedger.can_retry(
                    owner.ledger, apply[0]["key"], apply[1]["phase"]
                )
                or apply[1]["duplicate"]
            ):
                raise Refusal("retry_parent_not_unknown")
            previous = released or (apply if owner.mode == "hold_open" and not retry else None)
            duplicate = previous is not None
            prior = previous or apply
            targets[target.key] = {
                "target": target.description(),
                "phase": (
                    "superseded"
                    if owner.mode == "hold_open" and released is not None
                    else "duplicate"
                    if duplicate
                    else "prepared"
                    if owner.mode == "hold_open"
                    else "release_registered"
                ),
                "duplicate": duplicate,
                "claim": deepcopy(apply[1]["claim"])
                if retry
                else list(EmergencyEventCoordinator._claim(self))
                if owner.mode == "hold_open" and not duplicate
                else None,
                "release_claim": deepcopy(apply[1]["claim"])
                if owner.mode == "release" and apply is not None
                else None,
                "prior_operation": owner.retry_of
                if retry
                else prior[0]["key"][1]
                if prior is not None
                else None,
            }
        return {
            "kind": owner.kind,
            **(
                {"trigger": owner.trigger, "retry_of": owner.retry_of}
                if owner.kind == contract.KIND_V2
                else {}
            ),
            "event_ref": owner.event,
            "command": owner.mode,
            "registered_at": owner.lease.message._boundary.clock().now.isoformat(),
            "targets": targets,
        }

    def _fence(
        self, target: NativeDoorTarget, claim: tuple[str, str, str, str]
    ) -> EmergencyDoorFence:
        target.check()
        fence = EmergencyDoorFence.existing(target._transport, target.endpoint)
        if fence is None:
            # Reconstruct only the exact original journal's deny claim. Actual
            # execution still needs the original current release/target permit.
            fence = EmergencyDoorFence(target._transport, target.endpoint, claim, target._values)
        if fence.claim != claim or fence.target_signature != target._values:
            raise Refusal("emergency_claim_conflict")
        fence.check()
        return fence

    async def execute(self) -> dict[str, Any]:
        owner = EmergencyEventCoordinator._current(self)
        async with owner.lock:
            EmergencyEventCoordinator._current(self)
            if owner.record[0] is not None:
                return EmergencyEventCoordinator.receipt(self)
            async with owner.ledger.lock:
                EmergencyEventCoordinator._current(self)
                body = EmergencyEventCoordinator._body(self)
                record, fresh = owner.journal.begin(owner.lease, body)
                owner.record[0] = self._record = record
            if not fresh:
                return EmergencyEventCoordinator.receipt(self)
            EmergencyEventLedger.track_attempt(owner.ledger, record)
            try:
                for target in owner.targets:
                    row = owner.journal.read(record)["body"]["targets"][target.key]
                    if row["duplicate"]:
                        continue
                    if owner.mode == "release":
                        view = EmergencyEventCoordinator._view(self, target)
                        if (
                            view["apply"] is None
                            or view["apply"][1]["phase"] not in contract.CLAIM_PHASES
                        ):
                            EmergencyEventCoordinator._phase(
                                self, target, "tombstone_only", completion=True
                            )
                            continue
                    EmergencyEventCoordinator._guard(self, target, attempted=False)
                    await target.inspect_emergency(
                        owner.lease,
                        "alwaysOpen" if owner.mode == "hold_open" else "close",
                        "door/emergency_open"
                        if owner.mode == "hold_open"
                        else "door/emergency_release",
                        startup_guard=partial(
                            EmergencyEventCoordinator._guard, self, target, attempted=False
                        ),
                    )
                for target in owner.targets:
                    row = owner.journal.read(record)["body"]["targets"][target.key]
                    if row["phase"] not in {"prepared", "release_registered"}:
                        continue
                    async with owner.ledger.lock:
                        EmergencyEventCoordinator._guard(self, target, attempted=False)
                        existing = EmergencyDoorFence.existing(target._transport, target.endpoint)
                        if (
                            owner.mode == "hold_open"
                            and existing is not None
                            and owner.retry_of is None
                        ):
                            raise Refusal("emergency_claim_conflict")
                        if owner.mode == "hold_open":
                            claim = contract.claim(row["claim"])
                            if claim is None:
                                raise Refusal("invalid_storage")
                        else:
                            released = contract.claim(row["release_claim"])
                            if released is None:
                                raise Refusal("invalid_storage")
                            peer, operation, binding, request = released
                            claim = peer, operation, binding, request
                        if existing is not None and (
                            existing.claim != claim or existing.target_signature != target._values
                        ):
                            raise Refusal("emergency_claim_conflict")
                        EmergencyEventCoordinator._phase(self, target, "attempted")
                        fence = EmergencyEventCoordinator._fence(self, target, claim)
                    phase = "unknown"
                    try:
                        await target.emergency(
                            owner.lease,
                            "alwaysOpen" if owner.mode == "hold_open" else "close",
                            "door/emergency_open"
                            if owner.mode == "hold_open"
                            else "door/emergency_release",
                            fence,
                            startup_guard=partial(EmergencyEventCoordinator._guard, self, target),
                        )
                        phase = "acknowledged"
                    finally:
                        EmergencyEventCoordinator._phase(self, target, phase, completion=True)
            except asyncio.CancelledError:
                raise
            except Exception:
                # Fixed state only, no provider body/exception/identity in output.
                pass
            finally:
                EmergencyEventLedger.track_attempt(owner.ledger, record, finished=True)
                for target in owner.targets:
                    row = owner.journal.read(record)["body"]["targets"][target.key]
                    if row["phase"] in {"prepared", "release_registered"}:
                        EmergencyEventCoordinator._phase(self, target, "denied", completion=True)
            return EmergencyEventCoordinator.receipt(self)

    async def close(self) -> None:
        # Until-release is deliberately independent of local task/policy expiry.
        # Join/cancel belongs to the original host; no implicit physical close.
        owner = _OWNERS.get(self) if type(self) is EmergencyEventCoordinator else None
        if owner is None:
            raise Refusal("binding_denied")
        owner.stopped[0] = True

    def receipt(self) -> dict[str, Any]:
        owner = EmergencyEventCoordinator._owner(self)
        record = owner.record[0]
        if record is None:
            raise Refusal("binding_denied")
        result = owner.journal.read(record)
        rows = tuple(result["body"]["targets"].values())
        targets = []
        for row in rows:
            prior: dict[str, Any] | None = None
            if row["duplicate"]:
                history = owner.ledger.view(owner.lease, owner.event, row["target"])
                matches = [
                    value
                    for value in history.values()
                    if value is not None and value[0]["key"][1] == row["prior_operation"]
                ]
                if not matches:
                    raise Refusal("invalid_storage")
                entry, previous = matches[0]
                prior = {
                    "original": deepcopy(entry["original"]),
                    "command": entry["body"]["command"],
                    "phase": previous["phase"],
                    "outcome": "unknown"
                    if previous["phase"]
                    in {"attempted", "unknown", "prepared", "release_registered"}
                    else previous["phase"],
                }
            if row["phase"] == "duplicate" and prior is None:
                raise Refusal("invalid_storage")
            outcome = (
                "unknown"
                if row["phase"] in {"attempted", "unknown", "prepared", "release_registered"}
                else prior["outcome"]
                if prior is not None and row["phase"] == "duplicate"
                else row["phase"]
            )
            targets.append(
                {
                    "target": {
                        key: value for key, value in row["target"].items() if key != "identity"
                    },
                    "phase": row["phase"],
                    "outcome": outcome,
                    "duplicate": row["duplicate"],
                    "prior_attempt": prior,
                    "physical_result": "unknown",
                }
            )
        return {
            "kind": owner.kind,
            **(
                {
                    "trigger": owner.trigger,
                    "retry_of": owner.retry_of,
                    "automatic_fire_supported": True,
                    "deployment_auto_state": "not_changed",
                }
                if owner.kind == contract.KIND_V2
                else {"automatic_fire_enabled": False}
            ),
            "original": result["original"],
            "event_ref": owner.event,
            "command": owner.mode,
            "duplicate": all(row["duplicate"] for row in rows),
            "targets": targets,
            "hold_policy": "until_matching_release",
            "dedup_retention": "durable_no_automatic_eviction",
            "physical_result": "unknown",
            "atomic_all": False,
            "replay_available": False,
        }
