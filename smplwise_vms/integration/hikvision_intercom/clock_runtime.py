"""Refresh device display rules independently of access and call-state availability."""

from __future__ import annotations

import asyncio
from contextvars import ContextVar, copy_context
from copy import deepcopy
from dataclasses import dataclass
from time import monotonic
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send

from .access_runtime import SIGNAL_ACCESS_CHANGED
from .access.commit_tasks import finish_owned_commit
from .client.client import HikvisionClient
from .client.clock import ClockClient
from .clock import UTC_ZONE
from .clock_health import ClockTrend
from .exceptions import HikvisionError

_clock_readers = ContextVar("wiskey_station_clock_readers", default=())


@dataclass(frozen=True, repr=False)
class _ClockLifetime:
    hass: Any
    factory: Any
    call_later: Any
    task: list
    timer: list
    life: list


class StationClock:
    def __init__(
        self, hass: HomeAssistant, client: HikvisionClient, manual: dict[str, Any] | None
    ) -> None:
        self.hass, self.client, self.manual = hass, ClockClient(client), manual
        self.observed: dict[str, Any] | None = None
        self.error: str | None = None
        self.trend = ClockTrend()
        self._task: asyncio.Task[None] | None = None
        self._timer: asyncio.TimerHandle | None = None
        self._closed = False
        self._creation = _ClockLifetime(
            hass, hass.async_create_background_task, hass.loop.call_later,
            [None], [None], [False, None],
        )

    def start(self) -> None:
        o = self._creation
        if not o.life[0] and not self._closed and o.task[0] is None:
            coroutine = StationClock._run_read(self)
            try:
                task = o.factory(coroutine, "Hikvision station clock", eager_start=False)
                if (
                    not isinstance(task, asyncio.Task)
                    or asyncio.Task.get_loop(task) is not asyncio.get_running_loop()
                    or asyncio.Task.get_coro(task) is not coroutine
                ):
                    raise RuntimeError("original clock task required")
            except BaseException:
                coroutine.close()
                raise
            o.task[0] = self._task = task

    async def async_refresh(self) -> None:
        o = self._creation
        if o.life[0] or self._closed:
            return
        timer = o.timer[0]
        if timer is not None:
            timer.cancel()
            o.timer[0] = None
            if self._timer is timer:
                self._timer = None
        StationClock.start(self)
        if o.task[0] is not None:
            await asyncio.shield(o.task[0])

    async def _run_read(self) -> None:
        o = self._creation
        if o.life[0] or self._closed or asyncio.current_task() is not o.task[0]:
            return
        active = [True]
        marker = _clock_readers.set((*_clock_readers.get(), (self._creation, active)))
        try:
            await StationClock._read(self)
        finally:
            active[0] = False
            _clock_readers.reset(marker)

    async def _read(self) -> None:
        o = self._creation
        try:
            async with asyncio.timeout(20):
                observed = await self.client.async_read()
            if o.life[0] or self._closed:
                return
            self.observed = observed
            self.trend.observe(self.observed, monotonic())
            self.error = None
        except (HikvisionError, TimeoutError):
            if o.life[0] or self._closed:
                return
            self.error = "clock_read_failed"
            self.trend.reset()
        finally:
            o = self._creation
            task = asyncio.current_task()
            if o.task[0] is task:
                o.task[0] = None
            if self._task is task:
                self._task = None
            if not o.life[0] and not self._closed:
                async_dispatcher_send(o.hass, SIGNAL_ACCESS_CHANGED)
                timer = [None]
                timer[0] = o.call_later(900, lambda: StationClock._scheduled(self, timer[0]))
                o.timer[0] = self._timer = timer[0]

    def _scheduled(self, timer: asyncio.TimerHandle) -> None:
        o = self._creation
        if o.life[0] or o.timer[0] is not timer:
            return
        o.timer[0] = None
        if self._timer is timer:
            self._timer = None
        StationClock.start(self)

    def public(self) -> dict[str, Any]:
        zone = self.manual or (self.observed["zone"] if self.observed else UTC_ZONE)
        return {
            "source": "manual" if self.manual else "device" if self.observed else "fallback",
            "zone": deepcopy(zone),
            "status": "stale"
            if self.observed and self.error
            else "unavailable"
            if not self.observed
            else "ready",
            "error": self.error,
            "device_time": self.observed["device_time"] if self.observed else None,
            "checked_at": self.observed["checked_at"] if self.observed else None,
            "skew_seconds": self.observed["skew_seconds"] if self.observed else None,
            "time_mode": self.observed["time_mode"] if self.observed else None,
            "device_zone": deepcopy(self.observed["zone"]) if self.observed else None,
            "measurement": deepcopy(self.observed.get("measurement")) if self.observed else None,
            "next_transition": deepcopy(self.observed.get("next_transition"))
            if self.observed
            else None,
            "drift_state": self.trend.state,
        }

    async def async_close(self) -> None:
        o = self._creation
        o.life[0] = self._closed = True
        deferred = asyncio.current_task() is o.task[0] or any(
            owner is o and active[0] for owner, active in _clock_readers.get()
        )
        if o.life[1] is None:
            timer, task = o.timer[0], o.task[0]
            if timer is not None:
                timer.cancel()
                o.timer[0] = None
                if self._timer is timer:
                    self._timer = None

            async def finish() -> None:
                if task is not None:
                    # A live read callback may request its own close through a
                    # descendant. Let that original bounded read return before
                    # joining it; cancelling it here can cancel the descendant
                    # before its caller resumes. _read still refuses publication.
                    if not deferred and not asyncio.Task.done(task):
                        asyncio.Task.cancel(task)
                    await asyncio.gather(task, return_exceptions=True)
                    if o.task[0] is task:
                        o.task[0] = None
                    if self._task is task:
                        self._task = None

            scope = copy_context()
            scope.run(_clock_readers.set, tuple(item for item in _clock_readers.get() if item[0] is not o))
            o.life[1] = asyncio.create_task(finish(), context=scope)
        if deferred:
            return
        await finish_owned_commit(o.life[1])
