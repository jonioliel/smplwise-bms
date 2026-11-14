"""Persistent HA hold-open programs using the guarded transition executor."""

from __future__ import annotations

import asyncio
import weakref
from contextlib import contextmanager
from contextvars import ContextVar, copy_context
from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from .commit_tasks import finish_owned_commit
from .hold_open import HoldOpenDrafts, HoldOpenExecutor, policy, window
from .models import AccessError, utc_now
from .repository import Save

_ISSUED = weakref.WeakKeyDictionary()
_SCOPES = ContextVar("wiskey_legacy_hold_admission", default=())
_CLOSING = ContextVar("wiskey_legacy_hold_closing", default=())


@dataclass(eq=False)
class _Lifetime:
    save: Any
    send: Any
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    state: dict = field(default_factory=lambda: {"schema": 1, "programs": {}})
    workers: dict = field(default_factory=dict)
    locks: dict = field(default_factory=dict)
    admissions: set = field(default_factory=set)
    paused: set = field(default_factory=set)
    closing: dict = field(default_factory=dict)
    key_closes: dict = field(default_factory=dict)
    stopping: bool = False


@dataclass(eq=False)
class _Admission:
    station: str
    task: asyncio.Task
    done: asyncio.Event = field(default_factory=asyncio.Event)


def _owner(programs):
    ref = _ISSUED.get(programs)
    owner = ref() if ref is not None else None
    if type(owner) is not _Lifetime:
        raise AccessError("station_unloaded")
    return owner


def _closed(owner, station):
    return owner.stopping or station in owner.paused


@contextmanager
def detached_hold_scope(programs):
    """An original cleanup child joins admission; it cannot inherit self-deferral."""
    owner = _owner(programs)
    token = _SCOPES.set(tuple(row for row in _SCOPES.get() if row[0] is not owner))
    closing = _CLOSING.set(tuple(row for row in _CLOSING.get() if row[0] is not owner))
    try:
        yield
    finally:
        _CLOSING.reset(closing)
        _SCOPES.reset(token)


class HoldPrograms:
    def __init__(self, save: Save, send: Any) -> None:
        self.save, self.send = save, send
        owner = _Lifetime(save, send)
        # Only weak global issuance. The original lifetime is held locally; a
        # replaced instance label cannot select a different lifetime.
        self._keep_lifetime = lambda: owner
        _ISSUED[self] = weakref.ref(owner)
        self.lock, self.locks, self.workers = owner.lock, {}, {}
        self.state = deepcopy(owner.state)

    def _publish(self, owner):
        self.state = deepcopy(owner.state)
        self.workers = {key: deepcopy(worker.state) for key, worker in owner.workers.items()}
        self.locks = dict(owner.locks)

    def _key_lock(self, owner, key):
        lock = owner.locks.setdefault(key, asyncio.Lock())
        self.locks = dict(owner.locks)
        return lock

    @contextmanager
    def _admission(self, station):
        owner = _owner(self)
        if self.save is not owner.save or self.send is not owner.send or _closed(owner, station):
            raise AccessError("station_unloaded")
        admitted = _Admission(station, asyncio.current_task())
        owner.admissions.add(admitted)
        token = _SCOPES.set((*_SCOPES.get(), (owner, admitted)))
        try:
            yield owner
        finally:
            owner.admissions.discard(admitted)
            admitted.done.set()
            _SCOPES.reset(token)

    def owns_current(self):
        owner = _owner(self)
        admitted = any(
            original is owner
            and row in owner.admissions
            and not row.done.is_set()
            and not row.task.done()
            for original, row in _SCOPES.get()
        )
        return admitted or any(
            original is owner and active[0] and not task.done()
            for original, task, active in _CLOSING.get()
        )

    def is_cleanup_task(self, key):
        """Only the module-issued frozen key close may detach inherited fences."""
        owner = _owner(self)
        task = asyncio.current_task()
        item = owner.state["programs"].get(key)
        return (
            task is not None
            and owner.key_closes.get(key) is task
            and not task.done()
            and item is not None
            and item["execution"]["owned"] is True
            and _closed(owner, item["station_id"])
        )

    def freeze(self, station=None):
        owner = _owner(self)
        if station is None:
            owner.stopping = True
        else:
            owner.paused.add(station)

    def is_frozen(self, station):
        return _closed(_owner(self), station)

    def reopen_station(self, station):
        """A verified new native runtime may recover, without replaying a window."""
        owner = _owner(self)
        if owner.stopping:
            raise AccessError("station_unloaded")
        task = owner.closing.get(station)
        if task is not None and not task.done():
            raise AccessError("station_unloaded")
        for key, item in owner.state["programs"].items():
            if item["station_id"] == station:
                closing = owner.key_closes.get(key)
                if closing is not None and not closing.done():
                    raise AccessError("station_unloaded")
                owner.key_closes.pop(key, None)
                owner.workers.pop(key, None)
        owner.closing.pop(station, None)
        owner.paused.discard(station)

    def load(self, data: Any) -> None:
        if data is None:
            return
        try:
            if (
                set(data) != {"schema", "programs"}
                or type(data["schema"]) is not int
                or data["schema"] != 1
                or not isinstance(data["programs"], dict)
                or len(data["programs"]) > 200
            ):
                raise AccessError("invalid_storage")
            for key, item in data["programs"].items():
                if not isinstance(item, dict) or set(item) != {
                    "station_id",
                    "door",
                    "api_id",
                    "identity",
                    "revision",
                    "policy",
                    "enabled",
                    "removing",
                    "execution",
                    "error",
                    "checked_at",
                }:
                    raise AccessError("invalid_storage")
                if key != HoldOpenDrafts.key(item["station_id"], item["door"]):
                    raise AccessError("invalid_storage")
                if (
                    type(item["revision"]) is not int
                    or item["revision"] < 1
                    or type(item["enabled"]) is not bool
                    or type(item["removing"]) is not bool
                ):
                    raise AccessError("invalid_storage")
                if (
                    not isinstance(item["identity"], str)
                    or not item["identity"]
                    or len(item["identity"]) > 512
                    or type(item["api_id"]) is not int
                    or item["api_id"] not in (1, 2)
                ):
                    raise AccessError("invalid_storage")
                if item["error"] not in (None, "technical_write_unknown") or (
                    item["checked_at"] is not None and not isinstance(item["checked_at"], str)
                ):
                    raise AccessError("invalid_storage")
                policy(item["policy"])
                HoldOpenExecutor(self.save, self.send).load(item["execution"])
        except (KeyError, TypeError, ValueError):
            raise AccessError("invalid_storage") from None
        owner = _owner(self)
        if owner.admissions or owner.workers or owner.stopping:
            raise AccessError("station_unloaded")
        owner.state = deepcopy(data)
        self._publish(owner)

    def listing(self, station: str) -> list[dict[str, Any]]:
        return [
            {k: deepcopy(v) for k, v in item.items() if k != "identity"}
            for item in _owner(self).state["programs"].values()
            if item["station_id"] == station
        ]

    async def persist(self, key: str, item: dict[str, Any] | None) -> None:
        owner = _owner(self)
        async with owner.lock:
            state = deepcopy(owner.state)
            if item is None:
                state["programs"].pop(key, None)
            else:
                state["programs"][key] = deepcopy(item)

            async def commit() -> None:
                await owner.save(deepcopy(state))
                owner.state = state
                self._publish(owner)

            task = asyncio.create_task(commit())
            await finish_owned_commit(task)

    def worker(self, key: str) -> HoldOpenExecutor:
        owner = _owner(self)
        if key not in owner.workers:

            async def save(execution: dict[str, Any]) -> None:
                item = owner.state["programs"][key]
                await HoldPrograms.persist(
                    self, key, {**item, "execution": execution, "checked_at": utc_now()}
                )

            async def send(command: str) -> None:
                item = deepcopy(owner.state["programs"][key])
                if command == "alwaysOpen" and _closed(owner, item["station_id"]):
                    raise AccessError("station_unloaded")
                await owner.send(item, command)

            worker = HoldOpenExecutor(save, send, commissioned=True)
            worker.load(owner.state["programs"][key]["execution"])
            owner.workers[key] = worker
            self._publish(owner)
        return owner.workers[key]

    async def update(
        self,
        station: str,
        door: int,
        revision: int,
        value: Any,
        identity: str,
        api_id: int,
        enabled: bool,
    ) -> None:
        parsed = policy(value)
        key = HoldOpenDrafts.key(station, door)
        with self._admission(station) as owner:
            async with HoldPrograms._key_lock(self, owner, key):
                if _closed(owner, station):
                    raise AccessError("station_unloaded")
                old = owner.state["programs"].get(key)
                if type(revision) is not int or revision != (old["revision"] if old else 0):
                    raise AccessError("revision_conflict")
                if old and (old["enabled"] or old["execution"]["owned"] or old["removing"]):
                    raise AccessError("hold_pause_before_edit")
                if not old and len(owner.state["programs"]) >= 200:
                    raise AccessError("schedule_limit")
                await self.persist(
                    key,
                    {
                        "station_id": station,
                        "door": door,
                        "api_id": api_id,
                        "identity": identity,
                        "revision": revision + 1,
                        "policy": parsed,
                        "enabled": enabled,
                        "removing": False,
                        "execution": {"owned": False, "attempted": None, "status": "idle"},
                        "error": None,
                        "checked_at": None,
                    },
                )
                owner.workers.pop(key, None)

    async def action(self, station: str, door: int, revision: int, action: str) -> None:
        if action not in {"pause", "remove"}:
            raise AccessError("invalid_fields")
        key = HoldOpenDrafts.key(station, door)
        with self._admission(station) as owner:
            async with HoldPrograms._key_lock(self, owner, key):
                if _closed(owner, station):
                    raise AccessError("station_unloaded")
                item = owner.state["programs"].get(key)
                if type(revision) is not int or item is None or item["revision"] != revision:
                    raise AccessError("revision_conflict")
                await self.persist(
                    key,
                    {
                        **item,
                        "enabled": False,
                        "removing": action == "remove",
                        "revision": revision + 1,
                    },
                )
        await self.tick_key(key, datetime.now().astimezone())

    async def tick_key(self, key: str, now: datetime) -> None:
        station = key.rsplit("/", 1)[0]
        if _closed(_owner(self), station):
            return
        with self._admission(station) as owner:
            async with HoldPrograms._key_lock(self, owner, key):
                if _closed(owner, station):
                    return
                item = owner.state["programs"].get(key)
                if item is None:
                    return
                worker = self.worker(key)
                try:
                    desired = (
                        window(item["policy"], now)
                        if item["enabled"] and not item["removing"]
                        else None
                    )
                    await worker.tick(desired)
                except Exception:
                    await self.persist(
                        key, {**owner.state["programs"][key], "error": "technical_write_unknown"}
                    )
                    return
                current = owner.state["programs"][key]
                if current["removing"] and not worker.state["owned"]:
                    await self.persist(key, None)
                    owner.workers.pop(key, None)
                elif current["error"]:
                    await self.persist(key, {**current, "error": None})

    async def tick(self, now: datetime) -> None:
        owner = _owner(self)
        if owner.stopping:
            return
        slots = asyncio.Semaphore(3)

        async def run(key: str) -> None:
            async with slots:
                await self.tick_key(key, now)

        await asyncio.gather(*(run(key) for key in list(owner.state["programs"])))

    async def close(self, station=None):
        """Freeze before waiting; join original admissions and one close per key."""
        owner = _owner(self)
        HoldPrograms.freeze(self, station)
        if station not in owner.closing:

            async def finish():
                active = [True]
                marker = _CLOSING.set((*_CLOSING.get(), (owner, asyncio.current_task(), active)))
                try:
                    while rows := tuple(
                        row for row in owner.admissions if station is None or row.station == station
                    ):
                        await asyncio.gather(*(row.done.wait() for row in rows))
                    tasks = []
                    for key, item in tuple(owner.state["programs"].items()):
                        if station is not None and item["station_id"] != station:
                            continue
                        if key not in owner.key_closes:
                            owner.key_closes[key] = asyncio.create_task(
                                HoldPrograms._close_key(self, owner, key)
                            )
                        tasks.append(owner.key_closes[key])
                    results = await asyncio.gather(*tasks, return_exceptions=True)
                    if any(isinstance(value, asyncio.CancelledError) for value in results):
                        raise asyncio.CancelledError
                    if any(isinstance(value, BaseException) for value in results):
                        raise AccessError("technical_write_unknown")
                finally:
                    active[0] = False
                    _CLOSING.reset(marker)

            scope = copy_context()
            scope.run(_SCOPES.set, tuple(row for row in _SCOPES.get() if row[0] is not owner))
            scope.run(_CLOSING.set, tuple(row for row in _CLOSING.get() if row[0] is not owner))
            owner.closing[station] = asyncio.create_task(finish(), context=scope)
        if HoldPrograms.owns_current(self):
            return
        await finish_owned_commit(owner.closing[station])

    async def _close_key(self, owner, key):
        async with HoldPrograms._key_lock(self, owner, key):
            item = owner.state["programs"].get(key)
            if item is None or not item["execution"]["owned"]:
                return

            # Do not adopt mutable public worker/state labels. The original
            # persisted private image is the authority for cleanup only.
            async def save(execution):
                current = owner.state["programs"][key]
                await HoldPrograms.persist(
                    self,
                    key,
                    {
                        **current,
                        "execution": execution,
                        "checked_at": utc_now(),
                        "error": "technical_write_unknown"
                        if execution["status"] == "unknown"
                        else None,
                    },
                )

            async def send(command):
                if command != "close":
                    raise AccessError("station_unloaded")
                await owner.send(deepcopy(item), command)

            cleanup = HoldOpenExecutor(save, send, commissioned=True)
            cleanup.load(deepcopy(item["execution"]))
            try:
                await HoldOpenExecutor.close_owned(cleanup)
            except BaseException:
                if cleanup.state["owned"]:
                    state = deepcopy(owner.state)
                    state["programs"][key].update(
                        execution={**item["execution"], "owned": True, "status": "unknown"},
                        error="technical_write_unknown",
                    )
                    owner.state = state
                    self._publish(owner)
                else:
                    owner.workers.pop(key, None)
                raise
            owner.workers.pop(key, None)
            self._publish(owner)
