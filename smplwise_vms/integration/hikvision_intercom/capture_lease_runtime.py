"""HA lifetime and independent expiry for an explicitly installed capture source.

The public registrar is synchronous despite its async_ name. Its original
registration receipt owns async_unload. A separately composed cleanup callback
is optional and does not substitute for retiring that original receipt.
No bridge API, DTO type, actor mapping, key or collector is invented here. An
ordinary station entry therefore starts with no capture source installed.
"""

from __future__ import annotations

import asyncio
import inspect
import sys
import weakref
from contextvars import Context, ContextVar
from dataclasses import dataclass, field
from types import ModuleType

from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import callback

from .trusted_actions.capture_lease_host import CaptureLeaseHost
from .trusted_actions.lease_experimental import LeaseRejected
from .trusted_actions.source_bindings import same_ports
from .trusted_actions.validation import aware

_OWNERS = weakref.WeakKeyDictionary()
_CONSUMERS = weakref.WeakKeyDictionary()
_BINDINGS = weakref.WeakKeyDictionary()
_OWNER_CONSUMERS = weakref.WeakKeyDictionary()
_STATUS = weakref.WeakKeyDictionary()
_CALL_LINEAGE = ContextVar("wiskey_capture_consumer_lineage", default=frozenset())
_CLOSE_LINEAGE = ContextVar("wiskey_capture_close_lineage", default=frozenset())
_BRIDGE = "custom_components.smplwise_bridge"
_MAX_CALLS = 32
_REGISTRATION_OWNER = "wiskey_capture"


class _LoopScheduler:
    def __init__(self):
        loop = asyncio.get_running_loop()
        self.time, self.call_at, self.call_soon = loop.time, loop.call_at, loop.call_soon


@dataclass(eq=False)
class _Scope:
    consumer: object
    task: object
    active: bool = True


@dataclass
class _TaskState:
    timer: object = None
    probe: object = None
    token: object = field(default_factory=object)
    closing: object = None
    signal: object = None
    silence_deadline: object = None
    ready: bool = False
    closed: bool = False
    attempted: bool = False
    cleanup_failed: bool = False
    registration: object = None
    registration_unload: object = None


class _EntryLifetime:
    def __init__(self, hass, entry):
        self.hass, self.entry = hass, entry
        self.runtime = entry.runtime_data
        self.consumer = None
        self.closed = False

    def check(self):
        if (
            self.closed
            or _OWNERS.get(self.hass, {}).get(self.entry.entry_id) is not self
            or self.hass.config_entries.async_get_entry(self.entry.entry_id) is not self.entry
            or self.entry.runtime_data is not self.runtime
            or self.runtime.is_closed is not False
        ):
            raise LeaseRejected("state", "unverified")

    def freeze(self):
        """Synchronous invalidation also covers HA's unload callback path."""
        self.closed = True
        consumer = _OWNER_CONSUMERS.get(self)
        if consumer is not None:
            consumer.freeze()
            consumer.start_close()

    async def close(self):
        self.freeze()
        consumer = _OWNER_CONSUMERS.get(self)
        if consumer is not None:
            await consumer.close()
        owners = _OWNERS.get(self.hass, {})
        # Reentrant close may return while the original finalizer is still
        # joining. A failed cleanup also retains that exact consumer. Neither
        # case permits replacing its entry lifetime with a new owner.
        if owners.get(self.entry.entry_id) is self and self not in _OWNER_CONSUMERS:
            del owners[self.entry.entry_id]
        _STATUS.setdefault(self.hass, {})[self.entry.entry_id] = {
            "registration_state": "retired",
            "cleanup_failed": bool(consumer and consumer.cleanup_failed),
        }


@dataclass(frozen=True, eq=False)
class _Binding:
    owner: object
    hass: object
    entry: object
    runtime: object
    bridge_entry: object
    bridge_runtime: object
    module: object
    register_module: object
    register_module_name: str
    register: object
    unregister: object
    host: object
    host_ports: tuple
    scheduler: object
    scheduler_ports: tuple
    calls: set
    cleanups: set
    deadlines: dict
    registrations: list
    state: _TaskState
    host_failures: list
    native_source: object = None
    native_ports: tuple = ()


class CaptureLeaseConsumer:
    """Keyless consumer with original HA ownership and a monotonic watchdog.

    Construction is private to async_bind_capture_lease. Its bridge fixture in
    tests proves HA lifecycle mechanics, not an undisclosed Arx implementation.
    """

    def __init__(
        self, owner, bridge_entry, module, register_module, register, unregister, host,
        bridge_source=None,
    ):
        self._owner, self._bridge_entry = owner, bridge_entry
        self._bridge_runtime = getattr(bridge_entry, "runtime_data", None)
        self._module, self._register, self._unregister = module, register, unregister
        self._register_module = register_module
        self._host = host
        self._scheduler = _LoopScheduler()
        self._deadlines = {}
        self._calls, self._cleanups = set(), set()
        _BINDINGS[self] = _Binding(
            owner, owner.hass, owner.entry, owner.runtime, bridge_entry,
            self._bridge_runtime, module, register_module, register_module.__name__,
            register, unregister, host,
            (host.check_binding, host.sweep, host.invalidate, host.handle,
             host.cleanup, host.close, host.owns_current_lifecycle, host.request_context),
            self._scheduler,
            (self._scheduler.time, self._scheduler.call_at, self._scheduler.call_soon),
            self._calls, self._cleanups, self._deadlines, [], _TaskState(), host.cleanup_failures,
            bridge_source, (() if bridge_source is None else (
                bridge_source.current, bridge_source.bind_registration, bridge_source.matches,
                bridge_source.registration_retired,
                bridge_source.release_registration,
            )),
        )

    @property
    def _timer(self):
        return _BINDINGS[self].state.timer

    @property
    def _probe_handle(self):
        return _BINDINGS[self].state.probe

    @property
    def _closing(self):
        return _BINDINGS[self].state.closing

    @property
    def _signal(self):
        return _BINDINGS[self].state.signal

    @property
    def _silence_deadline(self):
        return _BINDINGS[self].state.silence_deadline

    @property
    def _ready(self):
        return _BINDINGS[self].state.ready

    @property
    def _closed(self):
        return _BINDINGS[self].state.closed

    @property
    def _attempted(self):
        return _BINDINGS[self].state.attempted

    @property
    def cleanup_failed(self):
        return _BINDINGS[self].state.cleanup_failed

    def _roots(self):
        original = _BINDINGS[self]
        owner, hass, host, scheduler = (
            original.owner, original.hass, original.host, original.scheduler
        )
        if (
            self._closed
            or self._owner is not owner or owner.hass is not hass
            or owner.entry is not original.entry or owner.runtime is not original.runtime
            or original.entry.state is not ConfigEntryState.LOADED
            or self._bridge_entry is not original.bridge_entry
            or self._bridge_runtime is not original.bridge_runtime
            or self._module is not original.module or self._register is not original.register
            or self._register_module is not original.register_module
            or self._unregister is not original.unregister or self._host is not host
            or self._scheduler is not scheduler or self._calls is not original.calls
            or self._cleanups is not original.cleanups or self._deadlines is not original.deadlines
            or not same_ports(original.host_ports, (
                host.check_binding, host.sweep, host.invalidate, host.handle,
                host.cleanup, host.close, host.owns_current_lifecycle, host.request_context,
            ))
            or not same_ports(original.scheduler_ports, (
                scheduler.time, scheduler.call_at, scheduler.call_soon,
            ))
            or _CONSUMERS.get(hass) is not self
            or owner.consumer is not self or _OWNER_CONSUMERS.get(owner) is not self
            or hass.config_entries.async_get_entry(self._bridge_entry.entry_id)
            is not self._bridge_entry
            or self._bridge_entry.domain != "smplwise_bridge"
            or self._bridge_entry.state is not ConfigEntryState.LOADED
            or original.native_source is None
            and getattr(self._bridge_entry, "runtime_data", None) is not self._bridge_runtime
            or sys.modules.get(_BRIDGE) is not self._module
            or original.register_module.__name__ != original.register_module_name
            or sys.modules.get(original.register_module_name) is not original.register_module
            or getattr(original.register_module, "async_register_consumer", None)
            is not original.register
            or original.state.registration is not None and not same_ports(
                (original.state.registration_unload,),
                (getattr(original.state.registration, "async_unload", None),),
            )
        ):
            raise LeaseRejected("state", "unverified")
        source = original.native_source
        if source is not None and (
            not same_ports(original.native_ports, (
                source.current, source.bind_registration, source.matches,
                source.registration_retired, source.release_registration,
            ))
            or original.native_ports[2](hass, original.bridge_entry) is not True
        ):
            raise LeaseRejected("state", "unverified")
        _EntryLifetime.check(owner)

    def _check(self):
        self._roots()
        _BINDINGS[self].host_ports[0]()
        self._roots()  # An injected host/source callback may have run Python.

    async def register(self):
        try:
            self._check()
            _BINDINGS[self].state.attempted = True  # Exception cannot prove absence.
            original = _BINDINGS[self]

            async def register_original():
                scope = _Scope(self, asyncio.current_task())
                lineage = _CALL_LINEAGE.set(_CALL_LINEAGE.get() | {scope})
                try:
                    registration = original.register(
                        original.hass, self, owner=_REGISTRATION_OWNER
                    )
                    # Do not await a misbound registrar or adopt an asynchronous
                    # replacement as the original synchronous source contract.
                    if inspect.isawaitable(registration):
                        if inspect.iscoroutine(registration):
                            registration.close()
                        raise LeaseRejected("state", "unverified")
                    unload = getattr(registration, "async_unload", None)
                    if not callable(unload):
                        raise LeaseRejected("state", "unverified")
                    original.state.registration = registration
                    original.state.registration_unload = unload
                    if original.native_source is not None:
                        original.native_ports[1](registration, self)
                finally:
                    scope.active = False
                    _CALL_LINEAGE.reset(lineage)

            task = asyncio.create_task(register_original(), name="WisKey capture registration")
            original.registrations.append(task)
            await asyncio.shield(task)
            self._check()
            _BINDINGS[self].state.ready = True
            self._probe()
        except BaseException:
            await self.close()
            raise

    def _queue_probe(self):
        if not self._closed and self._probe_handle is None:
            _BINDINGS[self].state.probe = _BINDINGS[self].scheduler_ports[2](self._probe)

    async def handle(self, dto):
        """The original bridge supplies its immutable, verified DTO directly."""
        try:
            self._check()
        except LeaseRejected:
            self.freeze()
            self.start_close()
            raise
        if not self._ready or len(self._calls) >= _MAX_CALLS:
            raise LeaseRejected("state", "unverified")
        self._probe()
        self._check()
        task = asyncio.current_task()
        if task in self._calls:
            raise LeaseRejected("state", "unverified")
        self._calls.add(task)
        scope = _Scope(self, task)
        lineage = _CALL_LINEAGE.set(_CALL_LINEAGE.get() | {scope})
        # start() publishes its owned session before its first await. This
        # queued probe arms the independent timer even while start I/O blocks.
        self._queue_probe()
        original = _BINDINGS[self]
        windows = dict(original.deadlines)
        try:
            result = await original.host_ports[3](dto)
            try:
                request = original.host_ports[7](dto)
            except LeaseRejected:
                if result.get("result") in {"refused", "rejected"}:
                    return result
                raise
            if request.action == "capture_start":
                windows = dict(original.deadlines)
            elif request.lease_ref not in windows and request.lease_ref in original.deadlines:
                windows[request.lease_ref] = original.deadlines[request.lease_ref]
            try:
                self._check()
                self._probe()
                self._check()
            except LeaseRejected:
                self.freeze()
                self.start_close()
                # The host alone knows whether confirm crossed dispatch.
                if result.get("result") == "acknowledged" and "person" in result:
                    return original.host.answers.validate("capture_confirm", {
                        "result": "sent_unknown", "request_id": result["request_id"],
                    })
                if result.get("result") not in {"sent_unknown", "refused", "rejected"}:
                    raise
            # Last publication check uses the original monotonic port, with no
            # injected source callbacks after it. Keep the pre-call session
            # deadlines even when confirm already removed its original session.
            now = original.scheduler_ports[0]()
            window = windows.get(request.lease_ref)
            late = window is not None and now >= window[1]
            silence = self._silence_deadline
            if silence is not None and now >= silence:
                late = True
            if late and result.get("result") == "acknowledged" and "person" in result:
                original.host_ports[2]((request.lease_ref,))
                self._join_cleanup()
                return original.host.answers.validate("capture_confirm", {
                    "result": "sent_unknown", "request_id": result["request_id"],
                })
            if late and result.get("result") == "acknowledged" and (
                "session" in result or "capture" in result
            ):
                original.host_ports[2]((request.lease_ref,))
                self._join_cleanup()
                raise LeaseRejected("state", "unverified")
            return result
        finally:
            _BINDINGS[self].calls.discard(task)
            scope.active = False
            _CALL_LINEAGE.reset(lineage)
            # No fresh injected callbacks after the final publication check.
            self._queue_probe()

    def _join_cleanup(self):
        if any(not task.done() for task in _BINDINGS[self].cleanups):
            return
        async def clean():
            scope = _Scope(self, asyncio.current_task())
            lineage = _CLOSE_LINEAGE.set(_CLOSE_LINEAGE.get() | {scope})
            try:
                await _BINDINGS[self].host_ports[4]()
            except BaseException:
                _BINDINGS[self].state.cleanup_failed = True
            finally:
                if _BINDINGS[self].host_failures:
                    _BINDINGS[self].state.cleanup_failed = True
                scope.active = False
                _CLOSE_LINEAGE.reset(lineage)

        task = asyncio.create_task(clean(), name="WisKey capture lease cleanup")
        self._cleanups.add(task)
        task.add_done_callback(self._cleanups.discard)

    def _probe(self):
        if self._probe_handle is not None:
            self._probe_handle.cancel()
        _BINDINGS[self].state.probe = None
        if self._closed or not self._ready:
            return
        try:
            self._check()
            original = _BINDINGS[self]
            host = original.host
            now = original.host_ports[1]()
            monotonic = original.scheduler_ports[0]()
            self._roots()
            signal = (host.signal_generation, host.last_signal)
            if signal != self._signal:
                original.state.signal = signal
                original.state.silence_deadline = (
                    None if signal[1] is None else monotonic + max(
                        0.0, 15.0 - (now - signal[1]).total_seconds()
                    )
                )
            current = host.sessions
            remaining = {
                ref: pair for ref, pair in self._deadlines.items()
                if current.get(ref) is pair[0]
            }
            self._deadlines.clear()
            self._deadlines.update(remaining)
            for ref, session in tuple(current.items()):
                if ref not in self._deadlines:
                    expires = aware(session.message.body["params"]["lease"]["lease_expires_at"])
                    self._deadlines[ref] = (
                        session, monotonic + max(0.0, (expires - now).total_seconds())
                    )
            expired = {
                ref for ref, (session, deadline) in self._deadlines.items()
                if monotonic >= deadline and current.get(ref) is session
            }
            silent = (
                self._silence_deadline is not None and monotonic >= self._silence_deadline
            )
            if silent:
                original.host_ports[2]()
            elif expired:
                original.host_ports[2](expired)
            if host.retired:
                self._join_cleanup()
            remaining = {
                ref: pair for ref, pair in self._deadlines.items()
                if host.sessions.get(ref) is pair[0]
            }
            self._deadlines.clear()
            self._deadlines.update(remaining)
            deadlines = [pair[1] for pair in self._deadlines.values()]
            if self._silence_deadline is not None and not silent:
                deadlines.append(self._silence_deadline)
            self._arm(min(deadlines) if deadlines else None)
        except Exception:
            self.freeze()
            self.start_close()

    def _arm(self, deadline):
        state = _BINDINGS[self].state
        if self._timer is not None:
            self._timer.cancel()
            state.timer = None
        token = state.token = object()
        if deadline is not None:
            state.timer = _BINDINGS[self].scheduler_ports[1](deadline, self._expired, token)

    def _expired(self, token):
        if self._closed or token is not _BINDINGS[self].state.token:
            return
        _BINDINGS[self].state.timer = None
        self._probe()

    def freeze(self):
        state = _BINDINGS[self].state
        state.closed, state.ready = True, False
        state.token = object()
        for handle in (self._timer, self._probe_handle):
            if handle is not None:
                handle.cancel()
        state.timer, state.probe = None, None
        _BINDINGS[self].host_ports[2]()

    def start_close(self):
        if self._closing is None:
            # Never inherit an operation's host-owner marker: the finalizer
            # must join its original host Tasks rather than return reentrantly.
            _BINDINGS[self].state.closing = asyncio.create_task(
                self._join(), name="WisKey capture consumer close", context=Context()
            )

    async def _join(self):
        scope = _Scope(self, asyncio.current_task())
        lineage = _CLOSE_LINEAGE.set(_CLOSE_LINEAGE.get() | {scope})
        try:
            original = _BINDINGS[self]
            if self._attempted:
                # A late registrar may publish after unload began. Join that
                # exact original attempt before retiring its registration.
                await asyncio.gather(*original.registrations, return_exceptions=True)
                unload = original.state.registration_unload
                if unload is None:
                    raise LeaseRejected("state", "unverified")
                result = unload()
                if inspect.isawaitable(result):
                    result = await result
                if result is False:
                    original.state.cleanup_failed = True
                if original.native_source is not None and (
                    result is not True
                    or original.native_ports[3](original.state.registration) is not True
                ):
                    original.state.cleanup_failed = True
                if original.unregister is not None:
                    result = original.unregister()
                    if inspect.isawaitable(result):
                        result = await result
                    if result is False:
                        original.state.cleanup_failed = True
        except BaseException:
            _BINDINGS[self].state.cleanup_failed = True
        finally:
            scope.active = False
            _CLOSE_LINEAGE.reset(lineage)
            try:
                host_error = None
                try:
                    await original.host_ports[5]()
                except BaseException as error:
                    original.state.cleanup_failed = True
                    host_error = error
                if original.cleanups:
                    await asyncio.gather(*tuple(original.cleanups), return_exceptions=True)
                if original.calls:
                    await asyncio.gather(*tuple(original.calls), return_exceptions=True)
                if host_error is not None:
                    raise host_error
            finally:
                if original.host_failures:
                    original.state.cleanup_failed = True
                if not original.state.cleanup_failed and original.native_source is not None:
                    try:
                        original.native_ports[4](original.state.registration)
                    except BaseException:
                        original.state.cleanup_failed = True
                    else:
                        original.state.registration = None
                        original.state.registration_unload = None
                # A completed Task is not proof that unregister/native cleanup
                # succeeded. Quarantine the original owner and resources on
                # failure so another entry/namespace cannot take their place.
                if not original.state.cleanup_failed:
                    if _CONSUMERS.get(original.hass) is self:
                        del _CONSUMERS[original.hass]
                    if original.owner.consumer is self:
                        original.owner.consumer = None
                    if _OWNER_CONSUMERS.get(original.owner) is self:
                        del _OWNER_CONSUMERS[original.owner]
                _STATUS.setdefault(original.hass, {})[original.entry.entry_id] = {
                    "registration_state": "retired", "cleanup_failed": self.cleanup_failed,
                }

    async def close(self):
        self.freeze()
        self.start_close()
        original = _BINDINGS[self]
        active_lineage = any(
            scope.consumer is self and scope.active and not scope.task.done()
            and (scope.task in original.calls or scope.task in original.registrations
                 or scope.task in original.cleanups or scope.task is self._closing)
            for scope in _CALL_LINEAGE.get() | _CLOSE_LINEAGE.get()
        )
        if (
            active_lineage
            or asyncio.current_task() in original.calls
            or asyncio.current_task() is self._closing
            or original.host_ports[6]()
        ):
            return  # The owned finalizer joins this original call after it exits.
        cancelled = False
        while not self._closing.done():
            try:
                await asyncio.shield(self._closing)
            except asyncio.CancelledError:
                cancelled = True
        self._closing.result()
        if cancelled:
            raise asyncio.CancelledError


def async_setup_capture_entry(hass, entry):
    """Called by the real HA entry lifecycle; does not invent a source."""
    owners = _OWNERS.setdefault(hass, {})
    previous = owners.get(entry.entry_id)
    if previous is not None and (
        not previous.closed or previous in _OWNER_CONSUMERS
    ):
        raise ValueError("capture lifetime already registered")
    owner = _EntryLifetime(hass, entry)
    owners[entry.entry_id] = owner
    _STATUS.setdefault(hass, {})[entry.entry_id] = {
        "registration_state": "not_installed", "cleanup_failed": False,
    }
    owner.check()

    @callback
    def stop(_event):
        # HA schedules async stop handlers separately. Revoke synchronously
        # before an older station listener can start closing native resources.
        owner.freeze()
        hass.async_create_task(owner.close(), "WisKey capture stop")

    entry.async_on_unload(hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, stop))
    entry.async_on_unload(owner.freeze)


async def async_bind_capture_lease(
    hass, entry, bridge_entry, host, *, unregister=None, bridge_source=None,
):
    """Bind trusted native ports after the original bridge API is delivered.

    This is not a service or a JSON/configuration route. The actual original
    bridge module/export and original HA config entries are retained and checked
    after registration and on every call/timer. The original receipt is retained
    and retired first; unregister is optional additional native cleanup only.
    Actual capability/DTO/source composition still needs original Arx qualification.
    """
    from .capture_bridge_source import NativeCaptureBridgeSource

    owner = _OWNERS.get(hass, {}).get(entry.entry_id)
    module = sys.modules.get(_BRIDGE)
    # lease_service is the public API across these original bridge versions.
    # Never require the later root re-export on an earlier installed source.
    register_module = sys.modules.get(_BRIDGE + ".lease_service", module)
    register = getattr(register_module, "async_register_consumer", None)
    if (
        owner is None or owner.entry is not entry or owner.consumer is not None
        or type(host) is not CaptureLeaseHost or host.closed
        or type(module) is not ModuleType or module.__name__ != _BRIDGE
        or type(register_module) is not ModuleType
        or register_module.__name__ not in {_BRIDGE, _BRIDGE + ".lease_service"}
        or not callable(register) or unregister is not None and not callable(unregister)
        or _CONSUMERS.get(hass) is not None
        or bridge_source is not None and (
            type(bridge_source) is not NativeCaptureBridgeSource
            or bridge_source.matches(hass, bridge_entry) is not True
            or not same_ports(
                (host.verifier.owns_dto, host.verifier.project_dto, host.verifier.source_current),
                (bridge_source.owns_dto, bridge_source.project_dto, bridge_source.current),
            )
        )
    ):
        raise LeaseRejected("state", "unverified")
    owner.check()
    consumer = CaptureLeaseConsumer(
        owner, bridge_entry, module, register_module, register, unregister, host, bridge_source
    )
    owner.consumer = consumer
    _OWNER_CONSUMERS[owner] = consumer
    _CONSUMERS[hass] = consumer
    await consumer.register()
    return consumer


async def async_unload_capture_entry(hass, entry):
    owner = _OWNERS.get(hass, {}).get(entry.entry_id)
    if owner is not None and owner.entry is entry:
        await owner.close()


def capture_lease_status(hass, entry):
    """Lifecycle observation only; never a physical or bridge qualification."""
    owner = _OWNERS.get(hass, {}).get(entry.entry_id)
    consumer = owner.consumer if owner is not None and owner.entry is entry else None
    prior = _STATUS.get(hass, {}).get(entry.entry_id, {})
    state = prior.get("registration_state", "not_installed")
    if owner is not None and owner.closed:
        state = "retired"
    elif consumer is not None:
        state = "retired" if consumer._closed else "registered" if consumer._ready else "pending"
    return {
        "schema_version": 1, "registration_state": state,
        "bridge_qualification": "not_proven", "physical_capture_proven": False,
        "cleanup_failed": (
            consumer.cleanup_failed if consumer else prior.get("cleanup_failed", False)
        ),
    }
