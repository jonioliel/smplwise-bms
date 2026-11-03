"""Own each station session, polling lifecycle and selected momentary release."""

import asyncio
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import httpx
import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import Event, HomeAssistant, ServiceCall, callback
from homeassistant.exceptions import (
    ConfigEntryAuthFailed,
    ConfigEntryError,
    ConfigEntryNotReady,
    HomeAssistantError,
    ServiceValidationError,
)
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.service import (
    async_extract_config_entry_ids,
    async_register_admin_service,
)

from .access.manager import AccessManager
from .access_runtime import get_manager
from .client.access import AccessClient
from .client.client import ConnectionSettings, HikvisionClient, StationProfile, create_session
from .clock import named_zone
from .clock_runtime import StationClock
from .configuration import ManagedLock, PollOptions, managed_locks
from .const import DOMAIN, PLATFORMS
from .coordinator import IntercomCoordinator
from .event_manager import StationEvents, get_events
from .exceptions import (
    HikvisionAuthError,
    HikvisionError,
    HikvisionUnsupportedError,
    HikvisionValidationError,
)
from .issues import issue
from .media_lifetime import closing_owner, create_close_task, is_closing_owner, join_owned


@dataclass(eq=False, repr=False)
class _RuntimeMediaChild:
    child: Any
    owner: Any
    close: Callable
    task: list
    attached: asyncio.Task | None = None


@dataclass(eq=False, repr=False)
class _RuntimeMediaLifetime:
    children: dict = field(default_factory=dict)
    stopping: bool = False
    closing: asyncio.Task | None = None


@dataclass(slots=True)
class IntercomRuntime:
    hass: HomeAssistant
    client: HikvisionClient
    session: httpx.AsyncClient
    coordinator: IntercomCoordinator
    profile: StationProfile
    locks: tuple[ManagedLock, ...]
    pulse_seconds: float
    access_manager: AccessManager
    station_id: str
    events: StationEvents | None = None
    clock: StationClock | None = None
    unlocking_relays: set[int] = field(default_factory=set)
    released_relays: set[int] = field(default_factory=set)
    relay_timers: dict[int, Callable[[], None]] = field(default_factory=dict)
    unlocking: bool = False
    released: bool = False
    _closing: bool = field(default=False, init=False, repr=False)
    _media_lifetime: _RuntimeMediaLifetime = field(
        default_factory=_RuntimeMediaLifetime, init=False, repr=False
    )

    @property
    def is_closed(self) -> bool:
        """Stop accepting work before asynchronous cleanup starts."""
        return self._media_lifetime.stopping or self._closing or self.session.is_closed

    def _own_media(self, child: Any) -> None:
        from .audio_api import AudioBridge
        from .audio_tts import TtsPlayback
        from .mse_api import _MSERequest
        from .station_media_runtime import BridgeTalkSession

        if type(child) is AudioBridge:
            close = AudioBridge.async_close
        elif type(child) is TtsPlayback:
            close = TtsPlayback.async_close
        elif type(child) is _MSERequest:
            close = _MSERequest.async_close
        elif type(child) is BridgeTalkSession:
            close = BridgeTalkSession.async_close
        else:
            raise ValueError("native media child required")
        owner = child._creation
        registry = self._media_lifetime
        if (
            owner.runtime is not self
            or self.is_closed
            or registry.stopping
            or id(child) in registry.children
        ):
            raise ValueError("original active runtime required")
        registry.children[id(child)] = _RuntimeMediaChild(child, owner, close, owner.task)

    def _track_media_task(self, child: Any) -> None:
        registry = self._media_lifetime
        entry = registry.children.get(id(child))
        if entry is None or entry.child is not child:
            return
        task = entry.task[0]
        if task is None and entry.owner.life[1] and not entry.owner.life[0]:
            registry.children.pop(id(child), None)
            return
        if not isinstance(task, asyncio.Task) or entry.attached is task:
            return
        if entry.attached is not None:
            raise ValueError("original media task required")
        entry.attached = task

        def finished(_task: asyncio.Task) -> None:
            if registry.children.get(id(child)) is entry:
                registry.children.pop(id(child), None)

        task.add_done_callback(finished)

    def _retire_media(self, child: Any, owner: Any) -> None:
        registry = self._media_lifetime
        entry = registry.children.get(id(child))
        if entry is not None and entry.child is child and entry.owner is owner:
            registry.children.pop(id(child), None)

    async def _close_media(self) -> None:
        entries = tuple(self._media_lifetime.children.values())
        results = await asyncio.gather(
            *(entry.close(entry.child) for entry in entries), return_exceptions=True
        )
        for result in results:
            if isinstance(result, (Exception, asyncio.CancelledError)):
                raise result

    async def async_unlock(self, physical_index: int) -> None:
        if self.is_closed:
            raise ServiceValidationError(
                translation_domain=DOMAIN, translation_key="connection_closed"
            )
        selected = next(
            (lock for lock in self.locks if lock.physical_index == physical_index), None
        )
        if type(physical_index) is not int or selected is None:
            raise ServiceValidationError(
                translation_domain=DOMAIN, translation_key="lock_not_managed"
            )
        if physical_index in self.unlocking_relays:
            raise ServiceValidationError(
                translation_domain=DOMAIN, translation_key="release_in_progress"
            )
        self.unlocking_relays.add(physical_index)
        self.unlocking = bool(self.unlocking_relays)
        self.coordinator.async_update_listeners()
        try:
            await self.client.async_unlock(selected.api_id)
        except HikvisionError:
            raise HomeAssistantError(
                translation_domain=DOMAIN, translation_key="release_unconfirmed"
            ) from None
        else:
            if self.is_closed:
                # The command may have reached the station. Never replay it or
                # revive a pulse after this runtime started shutting down.
                raise HomeAssistantError(
                    translation_domain=DOMAIN, translation_key="release_unconfirmed"
                )
            previous_timer = self.relay_timers.pop(physical_index, None)
            if previous_timer:
                previous_timer()
            self.released_relays.add(physical_index)
            self.released = bool(self.released_relays)

            @callback
            def finish(now: datetime) -> None:
                self._finish_relay(physical_index, now)

            self.relay_timers[physical_index] = async_call_later(
                self.hass, self.pulse_seconds, finish
            )
        finally:
            self.unlocking_relays.discard(physical_index)
            self.unlocking = bool(self.unlocking_relays)
            if not self.is_closed:
                self.coordinator.async_update_listeners()

    @callback
    def _finish_relay(self, physical_index: int, _now: datetime) -> None:
        self.relay_timers.pop(physical_index, None)
        self.released_relays.discard(physical_index)
        self.released = bool(self.released_relays)
        if not self.is_closed:
            self.coordinator.async_update_listeners()

    async def async_close(self) -> None:
        from .legacy_hold_runtime import LegacyHoldRuntime, original_legacy_holds

        holds = original_legacy_holds(self.hass, self)
        owned_hold = False
        if holds is not None:
            LegacyHoldRuntime.freeze(holds, self)
            owned_hold = LegacyHoldRuntime.owns_current(holds)
        owner = self._media_lifetime
        owner.stopping = self._closing = True
        if is_closing_owner(owner):
            return
        if owner.closing is None:
            async def finish() -> None:
                with closing_owner(owner):
                    if holds is None:
                        await IntercomRuntime._close_resources(self)
                    else:
                        with LegacyHoldRuntime.detached(holds):
                            await IntercomRuntime._close_resources(self)
            owner.closing = create_close_task(
                finish(), without_owners=tuple(entry.owner for entry in owner.children.values())
            )
        caller = asyncio.current_task()
        if (owned_hold or is_closing_owner(owner) or caller is owner.closing or any(
            is_closing_owner(entry.owner) or entry.task[0] is caller
            for entry in owner.children.values()
        )):
            return
        _result, cancelled = await join_owned(owner.closing)
        if cancelled:
            raise asyncio.CancelledError

    async def _close_resources(self) -> None:
        from .legacy_hold_runtime import LegacyHoldRuntime, original_legacy_holds

        self._closing = True
        # Retain this close entry's ports before the first cleanup callback or
        # await can replace public dependency aliases. This does not certify
        # every resource's original construction or publication.
        station_id = self.station_id
        timers, released = self.relay_timers, self.released_relays
        timer_rows = tuple(timers.items())
        data = self.hass.data.get(DOMAIN, {})
        operation = data.get("call_operations", {}).get(station_id)
        caches = tuple((table, table.get(station_id)) for table in (
            data.get("call_results", {}),
            data.get("audio_results", {}),
            data.get("media_evidence", {}),
        ))
        media_close = IntercomRuntime._close_media
        clock_close = self.clock.async_close if self.clock else None
        events_close = self.events.async_close if self.events else None
        detach = self.access_manager.async_detach
        coordinator_close = self.coordinator.async_shutdown
        session_close = self.session.aclose
        holds = original_legacy_holds(self.hass, self)
        if holds is not None:
            original_close = LegacyHoldRuntime.original_session_close(holds, self)
            if original_close is not None:
                session_close = original_close
        first: BaseException | None = None

        def retire_cache(entries) -> None:
            for table, row in entries:
                if row is not None and row[0] is self and table.get(station_id) is row:
                    table.pop(station_id, None)

        async def calls() -> None:
            try:
                if operation and operation[0] is self:
                    operation[1].cancel()
                    await asyncio.gather(operation[1], return_exceptions=True)
            finally:
                retire_cache(caches[:2])

        for key, cancel in timer_rows:
            try:
                cancel()
            except (Exception, asyncio.CancelledError) as error:
                if first is None:
                    first = error
            finally:
                if timers.get(key) is cancel:
                    timers.pop(key, None)
        released.clear()
        self.released = False
        steps = (
            ((lambda: LegacyHoldRuntime.close(holds, self)) if holds is not None else None, ()),
            (media_close, (self,)), (calls, ()), (clock_close, ()),
            (events_close, ()), (detach, (station_id,)),
            (coordinator_close, ()), (session_close, ()),
        )
        for close, args in steps:
            if close is None:
                continue
            try:
                await close(*args)
            except (Exception, asyncio.CancelledError) as error:
                if first is None:
                    first = error
        retire_cache(caches[2:])
        if holds is not None:
            try:
                LegacyHoldRuntime.retire_runtime(holds, self)
            except (Exception, asyncio.CancelledError) as error:
                if first is None:
                    first = error
        if first is not None:
            raise first


type IntercomConfigEntry = ConfigEntry[IntercomRuntime]


async def _async_reload(hass: HomeAssistant, entry: IntercomConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_setup_runtime(hass: HomeAssistant, entry: IntercomConfigEntry) -> bool:
    try:
        settings = ConnectionSettings.from_mapping(entry.data)
        locks = managed_locks(entry.data)
        options = PollOptions.from_mapping(entry.options)
        mode = entry.options.get("display_time_zone", "device")
        if mode not in {"device", "manual"}:
            raise HikvisionValidationError("Invalid display time zone source")
        manual = (
            await hass.async_add_executor_job(named_zone, entry.options.get("manual_time_zone"))
            if mode == "manual"
            else None
        )
    except (HikvisionValidationError, KeyError):
        raise ConfigEntryError(
            translation_domain=DOMAIN, translation_key="invalid_configuration"
        ) from None
    session = await hass.async_add_executor_job(create_session, settings)
    client = HikvisionClient(
        session,
        settings,
        enabled_doors=frozenset(lock.api_id for lock in locks),
        expected_identity=entry.unique_id,
        physical_doors={lock.physical_index: lock.api_id for lock in locks},
    )
    coordinator = IntercomCoordinator(hass, entry, client)
    manager = get_manager(hass)
    manager.register(entry.entry_id, entry.title, bool(locks))
    unpublished_runtime = None
    try:
        profile = await client.async_profile()
        if profile.unique_id != entry.unique_id:
            issue(hass, "identity", active=True, entry_id=entry.entry_id)
            raise ConfigEntryError(translation_domain=DOMAIN, translation_key="identity_changed")
        if any(lock.api_id not in profile.api_door_ids for lock in locks):
            issue(hass, "relay_mapping", active=True, entry_id=entry.entry_id)
            raise ConfigEntryError(translation_domain=DOMAIN, translation_key="mapping_changed")
        issue(hass, "identity", active=False, entry_id=entry.entry_id)
        issue(hass, "relay_mapping", active=False, entry_id=entry.entry_id)
        baseline = entry.data.get("capability_baseline")
        observed = {
            "snapshot": profile.snapshot,
            "stream": profile.stream,
            "call_states": list(profile.call_states),
        }
        if baseline is None:
            hass.config_entries.async_update_entry(
                entry, data={**entry.data, "capability_baseline": observed}
            )
        regression = isinstance(baseline, dict) and (
            any(baseline.get(key) is True and not observed[key] for key in ("snapshot", "stream"))
            or any(
                value not in profile.call_states
                for value in baseline.get("call_states", [])
                if value in {"idle", "ring", "onCall"}
            )
        )
        issue(hass, "capability_regression", active=regression, entry_id=entry.entry_id)
        await coordinator.async_config_entry_first_refresh()
        unpublished_runtime = IntercomRuntime(
            hass,
            client,
            session,
            coordinator,
            profile,
            locks,
            options.pulse,
            manager,
            entry.entry_id,
        )
        from .access.native_emergency_recovery import restore_startup_refusals

        restore_startup_refusals(hass, entry, unpublished_runtime)
        entry.runtime_data = unpublished_runtime
        unpublished_runtime = None
        from .legacy_hold_runtime import LegacyHoldRuntime, original_legacy_holds

        holds = original_legacy_holds(hass)
        if holds is not None:
            LegacyHoldRuntime.attach(holds, entry.runtime_data)
        registry = er.async_get(hass)
        for index in {1, 2} - {lock.physical_index for lock in locks}:
            old = registry.async_get_entity_id("lock", DOMAIN, f"{entry.unique_id}_door_{index}")
            if old:
                registry.async_remove(old)
        await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
        manager.attach(entry.entry_id, AccessClient(client))
        entry.runtime_data.events = get_events(hass).attach(entry.runtime_data)
        runtime = entry.runtime_data
        was_online = coordinator.last_update_success

        @callback
        def recovered() -> None:
            nonlocal was_online
            if runtime.is_closed or entry.runtime_data is not runtime:
                return
            online = coordinator.last_update_success
            if online and not was_online:
                manager.request(entry.entry_id)
            was_online = online
            history = hass.data[DOMAIN].get("fleet_health")
            if history is not None:
                station = manager.stations.get(entry.entry_id)
                if history.record(
                    entry.entry_id,
                    online=online,
                    poll_ms=coordinator.last_poll_ms,
                    sync=station.status if station else "unknown",
                    events=runtime.events.status().get("stream", "unknown")
                    if runtime.events
                    else "unknown",
                ):
                    hass.async_create_background_task(
                        history.async_flush(), "WisKey fleet-health save", eager_start=False
                    )

        entry.async_on_unload(coordinator.async_add_listener(recovered))
        recovered()
    except BaseException as err:
        if unpublished_runtime is not None:
            # Startup refusal recovery ran before native effect publication.
            # Join the new original runtime's existing cleanup on refusal.
            await IntercomRuntime.async_close(unpublished_runtime)
        else:
            await manager.async_detach(entry.entry_id)
            await coordinator.async_shutdown()
            await session.aclose()
        if isinstance(err, HikvisionAuthError):
            raise ConfigEntryAuthFailed(
                translation_domain=DOMAIN, translation_key="authentication_failed"
            ) from None
        if isinstance(err, HikvisionUnsupportedError):
            raise ConfigEntryError(
                translation_domain=DOMAIN, translation_key="unsupported_device"
            ) from None
        if isinstance(err, HikvisionError):
            raise ConfigEntryNotReady(
                translation_domain=DOMAIN, translation_key="connection_failed"
            ) from None
        raise

    async def stop(_event: Event) -> None:
        await entry.runtime_data.async_close()

    entry.async_on_unload(hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, stop))
    entry.runtime_data.clock = StationClock(hass, client, manual)
    entry.runtime_data.clock.start()
    entry.async_on_unload(entry.add_update_listener(_async_reload))
    return True


async def async_unload_runtime(hass: HomeAssistant, entry: IntercomConfigEntry) -> bool:
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    await entry.runtime_data.async_close()
    return True


@callback
def async_register_services(hass: HomeAssistant) -> None:
    if hass.services.has_service(DOMAIN, "unlock_door"):
        return

    async def unlock(call: ServiceCall) -> None:
        ids = await async_extract_config_entry_ids(call)
        if not ids:
            raise ServiceValidationError(
                translation_domain=DOMAIN, translation_key="target_required"
            )
        targets: list[IntercomRuntime] = []
        for entry_id in ids:
            entry = hass.config_entries.async_get_entry(entry_id)
            if entry is None or entry.domain != DOMAIN:
                raise ServiceValidationError(
                    translation_domain=DOMAIN, translation_key="invalid_target"
                )
            runtime = getattr(entry, "runtime_data", None)
            if not isinstance(runtime, IntercomRuntime) or runtime.is_closed:
                raise ServiceValidationError(
                    translation_domain=DOMAIN, translation_key="target_unloaded"
                )
            if call.data["lock"] not in {lock.physical_index for lock in runtime.locks}:
                raise ServiceValidationError(
                    translation_domain=DOMAIN, translation_key="target_lock_not_managed"
                )
            targets.append(runtime)
        for runtime in targets:
            await runtime.async_unlock(call.data["lock"])

    async_register_admin_service(
        hass,
        DOMAIN,
        "unlock_door",
        unlock,
        vol.Schema(
            {
                **cv.ENTITY_SERVICE_FIELDS,
                vol.Required("lock", default=1): _physical_lock,
            }
        ),
    )


def _physical_lock(value: object) -> int:
    """Accept the UI's string selection or exact integer; never coerce booleans/floats."""
    if (type(value) is int and value in {1, 2}) or (type(value) is str and value in {"1", "2"}):
        return int(value)
    raise vol.Invalid("Invalid physical relay")
