"""Native finite hold and automation coordinators, no public route or activation.

Host-timed close is implemented here; a hardware-enforced expiry/physical lock
guarantee remains unproved. A native close restores normal control and must never
be called emergency deny-all. No frozen signed pulse DTO is expanded to a hold.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from copy import deepcopy
from dataclasses import astuple
from hashlib import sha256
from typing import Any

import httpx

from ..client.client import HikvisionClient
from ..client.effect_scope import RequestRule, native_effect_scope
from ..client.emergency_fence import EmergencyDoorFence
from ..client.technical import emergency_command, hold_command, verify_emergency_support
from ..client.transport import LimitedTransport
from ..trusted_actions.source_bindings import same_ports
from ..trusted_actions.validation import Refusal
from .arx_execution_authority import FeatureLease, StationGrant
from .arx_execution_journal import FeatureExecutionJournal
from .arx_feature_intents import absolute_time
from .hold_open import HoldOpenExecutor


def command_body(command):
    return (
        '<RemoteControlDoor version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">'
        f"<cmd>{command}</cmd></RemoteControlDoor>"
    ).encode()


class NativeDoorTarget:
    """Pins the actual native runtime, HA entry, station session and relay map."""

    def __init__(self, runtime, grant: StationGrant):
        from ..runtime import IntercomRuntime

        if type(runtime) is not IntercomRuntime or type(grant) is not StationGrant:
            raise Refusal("binding_denied")
        client = runtime.client
        if (
            type(client) is not HikvisionClient
            or type(client._session._transport) is not LimitedTransport
            or not client._expected_identity
        ):
            raise Refusal("binding_denied")
        self.runtime, self.grant = runtime, grant
        self._runtime, self._client, self._session = runtime, client, runtime.session
        self._hass, self._entries = runtime.hass, runtime.hass.config_entries
        self._entry = self._entries.async_get_entry(grant.station_id)
        self._values = (
            grant.station_id,
            grant.api_relay,
            grant.physical_relay,
            grant.mapping_revision,
            client._expected_identity,
        )
        self._locks = runtime.locks
        self._settings = client.settings
        self._connection = astuple(client.settings)
        self._transport = client._session._transport
        self._mapping = tuple(sorted(client.physical_doors.items()))
        self._enabled = client.enabled_doors
        self._ports = (
            self._entries.async_get_entry,
            runtime.async_unlock,
            client.async_unlock,
            client.async_confirm_identity,
            client._get,
            client._request,
        )
        self.check()

    def check(self) -> None:
        self._check_binding(cleanup=False)

    def check_owned(self) -> None:
        """Original cleanup may use an unloading runtime's still-open session.

        Identity, current original entry/runtime, ports and mapping stay pinned.
        This never permits an opening or targets a removed/replacement entry.
        """
        self._check_binding(cleanup=True)

    def _check_binding(self, *, cleanup: bool) -> None:
        from homeassistant.config_entries import ConfigEntryState

        r, c = self._runtime, self._client
        sid, api, physical, revision, identity = self._values
        if (
            self.runtime is not r
            or self.grant.station_id != sid
            or (self.grant.api_relay, self.grant.physical_relay, self.grant.mapping_revision)
            != (api, physical, revision)
            or r.client is not c
            or r.session is not self._session
            or c._session is not self._session
            or r.hass is not self._hass
            or self._hass.config_entries is not self._entries
            or self._entry is None
            or self._entry.state
            not in (
                {ConfigEntryState.LOADED, ConfigEntryState.UNLOAD_IN_PROGRESS}
                if cleanup
                else {ConfigEntryState.LOADED}
            )
            or self._entries.async_get_entry(sid) is not self._entry
            or getattr(self._entry, "runtime_data", None) is not r
            or r.station_id != sid
            or (self._session.is_closed if cleanup else r.is_closed)
            or r.locks is not self._locks
            or not any(lock.physical_index == physical and lock.api_id == api for lock in r.locks)
            or c._expected_identity != identity
            or r.profile.unique_id != identity
            or c.settings is not self._settings
            or astuple(c.settings) != self._connection
            or c._session._transport is not self._transport
            or c.enabled_doors is not self._enabled
            or tuple(sorted(c.physical_doors.items())) != self._mapping
            or api not in c.enabled_doors
            or c.physical_doors.get(physical) != api
            or not same_ports(
                self._ports,
                (
                    self._entries.async_get_entry,
                    r.async_unlock,
                    c.async_unlock,
                    c.async_confirm_identity,
                    c._get,
                    c._request,
                ),
            )
        ):
            raise Refusal("binding_denied")

    @property
    def key(self) -> str:
        return sha256(repr(self._values[:4]).encode()).hexdigest()

    def description(self) -> dict[str, Any]:
        sid, api, physical, revision, identity = self._values
        return {
            "station_id": sid,
            "api_relay": api,
            "physical_relay": physical,
            "mapping_revision": revision,
            "identity": identity,
        }

    def _rules(self, command: str) -> tuple[RequestRule, ...]:
        c = self._client
        base = c.settings.base_url
        rules = [
            RequestRule("GET", httpx.URL(base + "/ISAPI/System/deviceInfo")),
            RequestRule(
                "PUT",
                httpx.URL(base + f"/ISAPI/AccessControl/RemoteControl/door/{self._values[1]}"),
                command_body(command),
            ),
        ]
        if command != "open":
            rules.append(
                RequestRule(
                    "GET", httpx.URL(base + "/ISAPI/AccessControl/RemoteControl/door/capabilities")
                )
            )
        return tuple(rules)

    async def pulse(self, lease: FeatureLease):
        def current():
            self.check()
            lease.require("door/pulse")

        current()
        with native_effect_scope(self._client, current, self._rules("open")):
            await self._runtime.async_unlock(self._values[2])
        current()

    async def hold(self, lease: FeatureLease, command: str, *, cleanup=False, startup_guard=None):
        if command not in {"alwaysOpen", "close"} or cleanup and command != "close":
            raise Refusal("binding_denied")

        def current():
            if not cleanup and startup_guard is not None:
                startup_guard()
            if cleanup:
                self.check_owned()
            else:
                self.check()
            if not cleanup:
                lease.require("door/hold_open" if command == "alwaysOpen" else "door/restore")
                if startup_guard is not None:
                    startup_guard()

        current()
        with native_effect_scope(self._client, current, self._rules(command)):
            await hold_command(self._client, self._values[1], command, commissioned=True)
        current()

    @property
    def endpoint(self) -> httpx.URL:
        self.check()
        return httpx.URL(
            self._client.settings.base_url
            + f"/ISAPI/AccessControl/RemoteControl/door/{self._values[1]}"
        )

    async def inspect_emergency(
        self,
        lease: FeatureLease,
        command: str,
        permission: str,
        *,
        startup_guard: Callable[[], None] | None = None,
    ) -> None:
        def current() -> None:
            if startup_guard is not None:
                startup_guard()
            self.check()
            lease.require(permission)
            if startup_guard is not None:
                startup_guard()

        current()
        rules = tuple(rule for rule in self._rules(command) if rule.method == "GET")
        with native_effect_scope(self._client, current, rules):
            await self._client.async_confirm_identity()
            await verify_emergency_support(self._client, self._values[1], command)
        current()

    async def emergency(
        self,
        lease: FeatureLease,
        command: str,
        permission: str,
        fence: EmergencyDoorFence,
        *,
        startup_guard: Callable[[], None] | None = None,
    ) -> None:
        def current() -> None:
            if startup_guard is not None:
                startup_guard()
            self.check()
            lease.require(permission)
            fence.check()
            if startup_guard is not None:
                startup_guard()

        current()
        with fence.permit(current, command_body(command)):
            with native_effect_scope(self._client, current, self._rules(command)):
                await emergency_command(self._client, self._values[1], command, commissioned=True)
        current()
        if command == "close":
            fence.release(current)


def _primary(lease: FeatureLease, target: NativeDoorTarget, feature: str) -> None:
    if (
        type(lease) is not FeatureLease
        or type(target) is not NativeDoorTarget
        or lease.message.request.get("feature") != feature
    ):
        raise Refusal("Unauthorized")
    lease.check()
    target.check()
    params, grant = lease.message.request.parameters, target.grant
    if (
        grant not in lease.policy.stations
        or params["station_id"] != grant.station_id
        or params["relay"] != grant.physical_relay
        or params["mapping_revision"] != grant.mapping_revision
    ):
        raise Refusal("binding_denied")


class AutomationDoorCoordinator:
    def __init__(
        self, lease: FeatureLease, target: NativeDoorTarget, journal: FeatureExecutionJournal
    ):
        _primary(lease, target, "door_automations")
        lease.require("door/pulse")
        actor = lease.message.request.get("actor")
        if (
            actor["kind"] != "automation"
            or actor["automation_id"] != lease.message.request.parameters["automation_ref"]
        ):
            raise Refusal("Unauthorized")
        self.lease, self.target, self.journal = lease, target, journal
        self._owned = lease, target, journal
        self._lock, self._record = asyncio.Lock(), None

    async def execute(self) -> dict[str, Any]:
        if (self.lease, self.target, self.journal) != self._owned:
            raise Refusal("binding_denied")
        _primary(self.lease, self.target, "door_automations")
        async with self._lock:
            _primary(self.lease, self.target, "door_automations")
            record, fresh = self.journal.begin(self.lease, {"kind": "pulse", "phase": "prepared"})
            self._record = record
            if not fresh:
                return self.receipt()
            old = self.journal.read(record)
            self.journal.save(record, old["revision"], {"kind": "pulse", "phase": "attempted"})
            phase = "unknown"
            try:
                await self.target.pulse(self.lease)
                phase = "acknowledged"
            finally:
                # Publishing an outcome cannot mint another dispatch. It remains
                # possible after authority expires while an HTTP reply is in flight.
                old = self.journal.read(record)
                self.journal.save(
                    record, old["revision"], {"kind": "pulse", "phase": phase}, completion=True
                )
            return self.receipt()

    def receipt(self) -> dict[str, Any]:
        self.lease.check()
        result = self.journal.read(self._record)
        return {
            "original": result["original"],
            "phase": result["body"]["phase"],
            "physical_result": "unknown",
            "replay_available": False,
        }


class DoorWindowCoordinator:
    """One finite host-owned job using the existing durable HoldOpenExecutor.

    Start is admitted once. Save precedes alwaysOpen. Lost replies never retry
    opening. End, stop, cancellation or revocation joins a close attempt against
    the exact original native target. Offline/unpowered guarantees are UNPROVEN.
    """

    def __init__(
        self, lease: FeatureLease, target: NativeDoorTarget, journal: FeatureExecutionJournal
    ):
        _primary(lease, target, "door_windows")
        lease.require("door/hold_open")
        lease.require("door/restore")
        self.lease, self.target, self.journal = lease, target, journal
        self._owned = lease, target, journal
        self._lock, self._stop = asyncio.Lock(), asyncio.Event()
        self.open_acknowledged = asyncio.Event()
        self._record, self._worker, self._task, self._closing = None, None, None, None

    def _current(self):
        if (self.lease, self.target, self.journal) != self._owned or self._stop.is_set():
            raise Refusal("binding_denied")
        _primary(self.lease, self.target, "door_windows")

    async def _save(self, execution):
        old = self.journal.read(self._record)
        body = deepcopy(old["body"])
        body["resources"][self.target.key]["execution"] = execution
        # Only an already owned close/status completion can outlive authority.
        completion = FeatureExecutionJournal._completion(old["body"], body)
        if not completion:
            self._current()
        self.journal.save(self._record, old["revision"], body, completion=completion)

    async def _send(self, command):
        if command == "alwaysOpen":
            self._current()
        await self.target.hold(self.lease, command, cleanup=command == "close")

    async def _wait(self, until):
        while True:
            now = self.lease.message._boundary.clock().now
            remaining = (until - now).total_seconds()
            if remaining <= 0:
                return
            self._current()
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=min(remaining, 0.25))
            except TimeoutError:
                pass

    async def run(self) -> dict[str, Any]:
        self._current()
        async with self._lock:
            self._current()
            self._task = asyncio.current_task()
            body = {
                "kind": "hold",
                "resources": {
                    self.target.key: {
                        "target": self.target.description(),
                        "execution": {"owned": False, "attempted": None, "status": "idle"},
                    }
                },
            }
            self._record, fresh = self.journal.begin(self.lease, body)
            self._worker = HoldOpenExecutor(self._save, self._send, commissioned=True)
            self._worker.load(
                self.journal.read(self._record)["body"]["resources"][self.target.key]["execution"]
            )
            try:
                if not fresh:
                    # Recovery is cleanup-only; never resubmit an old opening.
                    await self._worker.tick(None)
                    return self.receipt()
                params = self.lease.message.request.parameters
                await self._wait(absolute_time(params["start"]))
                self._current()
                await self._worker.tick(self.lease.message.request.get("operation_id"))
                self.open_acknowledged.set()
                await self._wait(absolute_time(params["end"]))
            finally:
                await self.close()
            return self.receipt()

    async def close(self) -> None:
        self._stop.set()
        if self._worker is None:
            return
        if self._closing is None:
            self._closing = asyncio.create_task(self._worker.tick(None))
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
        execution = result["body"]["resources"][self.target.key]["execution"]
        return {
            "original": result["original"],
            "execution": execution,
            "physical_result": "unknown",
            "device_enforced_expiry": "unproven",
            "replay_available": False,
        }
