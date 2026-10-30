"""Native emergency fanout with exact targets, durable attempts and secure priority.

No atomic-all/physical-lock claim is made. Arx must resolve the complete policy
and review the proposed protocol. Existing closed emergency DTOs stay disabled.
"""

from __future__ import annotations

import asyncio
import weakref
from copy import deepcopy
from typing import Any

from ..client.emergency_fence import EmergencyDoorFence
from ..trusted_actions.envelope import thaw
from ..trusted_actions.validation import Refusal
from .arx_door_execution import NativeDoorTarget, _primary
from .arx_execution_authority import FeatureLease
from .arx_execution_journal import FeatureExecutionJournal
from .arx_feature_intents import absolute_time
from .hold_open import HoldOpenExecutor

_STARTUP_GUARDS = weakref.WeakKeyDictionary()


def restore_emergency_refusals(
    journal: FeatureExecutionJournal, targets: tuple[NativeDoorTarget, ...]
):
    """Rebind only additional refusal fences to matching native startup targets.

    This sends nothing, restores no peer and replays no secure/open command.
    Unbound claims remain durable and are returned for owner reconciliation.
    """
    result = []
    for item in journal.pending_secure_claims():
        matches = [t for t in targets if t._values == item["target_signature"]]
        if len(matches) != 1:
            result.append({"claim": item["claim"], "state": "unbound"})
            continue
        target = matches[0]
        target.check()
        fence = EmergencyDoorFence.existing(target._transport, target.endpoint)
        if fence is None:
            EmergencyDoorFence(target._transport, target.endpoint, item["claim"], target._values)
        elif fence.claim != item["claim"] or fence.target_signature != target._values:
            raise Refusal("emergency_claim_conflict")
        result.append({"claim": item["claim"], "state": "refusal_restored"})
    return result


class EmergencyCoordinator:
    """Secure/release once, or own finite unlock-all until joined cleanup.

    'All' is exactly the complete authenticated policy target list, never vendor
    relay 65535 or inferred discovery. Secure claims refuse ordinary native
    pulse/hold/close commands at transport level until an authenticated explicit
    release. Reconstructing the refusal fences on real startup is still required
    in the reviewed host composition; this module installs no real runtime hook.
    """

    def __init__(
        self,
        lease: FeatureLease,
        targets: tuple[NativeDoorTarget, ...],
        journal: FeatureExecutionJournal,
        *,
        startup_guard=None,
    ):
        if (
            type(lease) is not FeatureLease
            or type(targets) is not tuple
            or not 1 <= len(targets) <= 200
            or any(type(t) is not NativeDoorTarget for t in targets)
            or len({(t.grant.station_id, t.grant.physical_relay) for t in targets}) != len(targets)
            or {t.grant for t in targets} != set(lease.policy.stations)
        ):
            raise Refusal("binding_denied")
        private = thaw(lease.private_input)
        if (
            type(private) is not dict
            or set(private) != {"command", "release_refs"}
            or private["command"] not in {"lock_all", "unlock_all", "release_all"}
            or type(private["release_refs"]) is not dict
        ):
            raise Refusal("invalid_fields")
        self.mode = private["command"]
        self.permission = {
            "lock_all": "door/emergency_secure",
            "unlock_all": "door/emergency_open",
            "release_all": "door/emergency_release",
        }[self.mode]
        self.lease, self.targets, self.journal = lease, targets, journal
        if startup_guard is not None and not callable(startup_guard):
            raise Refusal("binding_denied")
        try:
            _STARTUP_GUARDS[self] = (
                weakref.ref(startup_guard) if startup_guard is not None else None,
            )
        except TypeError:
            raise Refusal("binding_denied") from None
        self._startup_guard = startup_guard
        self._owned = lease, targets, journal, self.mode, self.permission
        self._release_refs = private["release_refs"]
        if self.mode != "release_all" and self._release_refs:
            raise Refusal("invalid_fields")
        if self.mode == "release_all" and set(self._release_refs) != {t.key for t in targets}:
            raise Refusal("invalid_fields")
        self._lock, self._stop = asyncio.Lock(), asyncio.Event()
        self._record, self._closing = None, None
        self._workers = {}
        self.open_acknowledged = asyncio.Event()
        self._current()

    def _startup_current(self):
        record = _STARTUP_GUARDS.get(self)
        guard = record[0]() if record is not None and record[0] is not None else None
        if record is None or self._startup_guard is not guard:
            raise Refusal("binding_denied")
        if guard is not None:
            guard()
        if _STARTUP_GUARDS.get(self) is not record or self._startup_guard is not guard:
            raise Refusal("binding_denied")

    def _current(self):
        EmergencyCoordinator._startup_current(self)
        if (self.lease, self.targets, self.journal, self.mode, self.permission) != self._owned:
            raise Refusal("binding_denied")
        if self._stop.is_set():
            raise Refusal("binding_denied")
        self.lease.require(self.permission)
        if self.mode == "unlock_all":
            self.lease.require("door/hold_open")
            self.lease.require("door/restore")
        # Anchor the declared primary target; every remaining target is still an
        # explicit member of the same current complete authenticated source scope.
        primary = [
            t
            for t in self.targets
            if (
                t.grant.station_id == self.lease.message.request.parameters["station_id"]
                and t.grant.physical_relay == self.lease.message.request.parameters["relay"]
            )
        ]
        if len(primary) != 1:
            raise Refusal("binding_denied")
        _primary(self.lease, primary[0], "emergency_buttons")
        for target in self.targets:
            target.check()
        EmergencyCoordinator._startup_current(self)

    def _fence(self, target):
        fence = EmergencyDoorFence.existing(target._transport, target.endpoint)
        if (
            fence is None
            or type(self._release_refs.get(target.key)) is not list
            or tuple(self._release_refs[target.key]) != fence.claim
            or fence.target_signature != target._values
        ):
            raise Refusal("binding_denied")
        fence.check()
        return fence

    def _claim(self):
        message = self.lease.message
        return (
            message.verification.verified_peer_ref,
            message.request.get("operation_id"),
            message.request.get("operation_binding_ref"),
            message.request.get("request_id"),
        )

    def _phase(self, target, phase, *, completion=False):
        old = self.journal.read(self._record)
        body = deepcopy(old["body"])
        body["targets"][target.key]["phase"] = phase
        self.journal.save(self._record, old["revision"], body, completion=completion)

    def _deny_unstarted(self):
        for target in self.targets:
            if (
                self.journal.read(self._record)["body"]["targets"][target.key]["phase"]
                == "prepared"
            ):
                self._phase(target, "denied", completion=True)

    async def _preflight(self, command):
        for target in self.targets:
            self._current()
            if self.mode == "release_all":
                self._fence(target)
            elif (
                self.mode in {"lock_all", "unlock_all"}
                and EmergencyDoorFence.existing(target._transport, target.endpoint) is not None
            ):
                raise Refusal("emergency_claim_conflict")
            await target.inspect_emergency(
                self.lease,
                command,
                self.permission,
                startup_guard=lambda: EmergencyCoordinator._startup_current(self),
            )
            self._current()

    async def execute(self) -> dict[str, Any]:
        self._current()
        if self.mode == "unlock_all":
            return await self._run_unlock()
        async with self._lock:
            self._current()
            body = {
                "kind": "emergency",
                "mode": self.mode,
                "targets": {
                    t.key: {
                        "target": t.description()
                        | {
                            "claim": list(self._claim()) if self.mode == "lock_all" else None,
                            "release_claim": self._release_refs.get(t.key),
                        },
                        "phase": "prepared",
                    }
                    for t in self.targets
                },
            }
            self._record, fresh = self.journal.begin(self.lease, body)
            if not fresh:
                return self.receipt()
            command = "alwaysClose" if self.mode == "lock_all" else "close"
            try:
                await self._preflight(command)
                for target in self.targets:
                    self._current()
                    # Preflight awaited identity/capabilities. A concurrent
                    # original event may have claimed this output meanwhile.
                    # Refuse before persisting an impossible second claim.
                    if (
                        self.mode == "lock_all"
                        and EmergencyDoorFence.existing(target._transport, target.endpoint)
                        is not None
                    ):
                        raise Refusal("emergency_claim_conflict")
                    self._phase(target, "attempted")
                    self._current()
                    phase = "unknown"
                    try:
                        fence = (
                            EmergencyDoorFence(
                                target._transport, target.endpoint, self._claim(), target._values
                            )
                            if self.mode == "lock_all"
                            else self._fence(target)
                        )
                        await target.emergency(
                            self.lease,
                            command,
                            self.permission,
                            fence,
                            startup_guard=lambda: EmergencyCoordinator._startup_current(self),
                        )
                        phase = "acknowledged"
                    except Exception:
                        # An attempted target is UNKNOWN even when no ACK arrives.
                        # Continue only while the complete authority remains current.
                        pass
                    finally:
                        self._phase(target, phase, completion=True)
            finally:
                self._deny_unstarted()
            return self.receipt()

    async def _save_hold(self, target, execution):
        old = self.journal.read(self._record)
        body = deepcopy(old["body"])
        body["resources"][target.key]["execution"] = execution
        completion = FeatureExecutionJournal._completion(old["body"], body)
        if not completion:
            self._current()
        self.journal.save(self._record, old["revision"], body, completion=completion)

    async def _send_hold(self, target, command):
        if command == "alwaysOpen":
            self._current()
        await target.hold(
            self.lease,
            command,
            cleanup=command == "close",
            startup_guard=lambda: EmergencyCoordinator._startup_current(self),
        )

    async def _run_unlock(self):
        async with self._lock:
            self._current()
            body = {
                "kind": "hold",
                "resources": {
                    t.key: {
                        "target": t.description(),
                        "execution": {"owned": False, "attempted": None, "status": "idle"},
                    }
                    for t in self.targets
                },
            }
            self._record, fresh = self.journal.begin(self.lease, body)
            for target in self.targets:

                async def save(state, target=target):
                    await self._save_hold(target, state)

                async def send(command, target=target):
                    await self._send_hold(target, command)

                worker = HoldOpenExecutor(save, send, commissioned=True)
                worker.load(
                    self.journal.read(self._record)["body"]["resources"][target.key]["execution"]
                )
                self._workers[target.key] = worker
            try:
                if fresh:
                    await self._preflight("alwaysOpen")
                    for target in self.targets:
                        self._current()
                        await self._workers[target.key].tick(
                            self.lease.message.request.get("operation_id")
                        )
                    self.open_acknowledged.set()
                    end = absolute_time(self.lease.message.request.get("execution_expires_at"))
                    while (end - self.lease.message._boundary.clock().now).total_seconds() > 0:
                        self._current()
                        try:
                            await asyncio.wait_for(self._stop.wait(), timeout=0.25)
                        except TimeoutError:
                            pass
            finally:
                await self.close()
            return self.receipt()

    async def close(self) -> None:
        self._stop.set()
        if not self._workers:
            return
        if self._closing is None:

            async def finish():
                results = await asyncio.gather(
                    *(w.tick(None) for w in self._workers.values()), return_exceptions=True
                )
                for result in results:
                    if isinstance(result, BaseException):
                        raise result

            self._closing = asyncio.create_task(finish())
        cancelled = False
        while not self._closing.done():
            try:
                await asyncio.shield(self._closing)
            except asyncio.CancelledError:
                cancelled = True
        self._closing.result()
        if cancelled:
            raise asyncio.CancelledError

    def receipt(self) -> dict[str, Any]:
        result = self.journal.read(self._record)
        body = result["body"]
        collection = body["resources"] if body["kind"] == "hold" else body["targets"]
        targets = []
        for value in collection.values():
            target = {k: v for k, v in value["target"].items() if k != "identity"}
            targets.append(
                {
                    "target": target,
                    "execution": deepcopy(value.get("execution")),
                    "phase": value.get("phase"),
                    "physical_result": "unknown",
                }
            )
        return {
            "original": result["original"],
            "mode": self.mode,
            "targets": targets,
            "atomic_all": False,
            "physical_result": "unknown",
            "device_enforced_expiry": "unproven",
            "replay_available": False,
        }
