"""One-use native absence observations, never an ACK or caller-supplied DTO.

Only an actual AccessClient person read inside its original transaction can
issue a receipt. Original resources are weakly pinned outside instance labels;
the repository consumes it under its lock before changing any cleanup state.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any
from weakref import WeakKeyDictionary, ref

import httpx

from ..client.access import AccessCapabilities, AccessClient, StationInventory
from ..client.client import HikvisionClient
from .models import AccessError, ManagedUser


class StationMap(dict):
    """The original manager table can be borrowed without retaining its HA graph."""


@dataclass
class _Engine:
    repository: Any
    manager: Any = None
    stations: dict = field(default_factory=dict)


_ENGINES: WeakKeyDictionary = WeakKeyDictionary()
_RECEIPTS: WeakKeyDictionary = WeakKeyDictionary()
_OBSERVED: WeakKeyDictionary = WeakKeyDictionary()
_PERSON_READ = AccessClient.async_person
_REQUEST = HikvisionClient._request
_SEARCH_PORTS = tuple(
    (name, getattr(AccessClient, name)) for name in ("_search", "_search_pages", "_json")
)
_STREAM = httpx.AsyncClient.stream


class AbsenceEvidence:
    __slots__ = ("__weakref__",)


def register_engine(engine, repository) -> None:
    from .engine import SyncEngine

    if type(engine) is not SyncEngine or engine in _ENGINES or engine.repository is not repository:
        raise AccessError("readback_unavailable")
    _ENGINES[engine] = _Engine(ref(repository))
    _OBSERVED.setdefault(repository, {})


def bind_manager(engine, manager) -> None:
    from .manager import AccessManager

    origin = _ENGINES.get(engine)
    if (
        origin is None
        or origin.manager is not None
        or type(manager) is not AccessManager
        or manager.engine is not engine
        or manager.repository is not origin.repository()
        or type(manager.stations) is not StationMap
    ):
        raise AccessError("readback_unavailable")
    origin.manager = ref(manager)


def station_attached(engine, station: str, driver: AccessClient) -> None:
    origin = _ENGINES.get(engine)
    if origin is None or type(driver) is not AccessClient:
        raise AccessError("readback_unavailable")
    origin.stations[station] = (ref(driver), object())


def station_detached(engine, station: str) -> None:
    origin = _ENGINES.get(engine)
    if origin is not None:
        origin.stations.pop(station, None)


def station_started(engine, station: str, driver: AccessClient) -> None:
    origin = _ENGINES.get(engine)
    if origin is None or origin.repository() is not engine.repository:
        raise AccessError("readback_unavailable")
    if origin.manager is not None:
        manager = origin.manager()
        source = manager.stations.get(station) if manager is not None else None
        if (
            source is None
            or manager._closed
            or manager.engine is not engine
            or source.driver is not driver
        ):
            raise AccessError("station_changed")
    previous = origin.stations.get(station)
    if previous is None or previous[0]() is not driver:
        station_attached(engine, station, driver)


def _check(record: dict, *, worker=True) -> None:
    engine, repo, driver, client, task = (
        record[k]()
        for k in (
            "engine",
            "repository",
            "driver",
            "client",
            "task",
        )
    )
    if any(value is None for value in (engine, repo, driver, client)) or worker and task is None:
        raise AccessError("station_changed")
    origin = _ENGINES.get(engine)
    epoch = origin.stations.get(record["station"]) if origin is not None else None
    if (
        origin is None
        or origin.repository() is not repo
        or engine.repository is not repo
        or epoch is None
        or epoch[0]() is not driver
        or epoch[1] is not record["epoch"]
        or driver.client is not client
        or worker
        and (
            driver._owner is not task
            or asyncio.Task.done(task)
            or asyncio.Task.get_coro(task) is not record["coroutine"]()
        )
        or client._session is not record["session"]()
        or client._session.is_closed
        or client.settings is not record["settings"]
        or client.settings != record["settings_values"]
        or client._expected_identity != record["identity"]
        or client.physical_doors is not record["doors"]
        or client.physical_doors != record["door_values"]
        or worker
        and driver.capabilities is not record["capabilities"]
        or type(driver.capabilities) is not AccessCapabilities
        or driver.capabilities != record["capability_values"]
        or getattr(driver.async_person, "__func__", None) is not _PERSON_READ
        or any(
            getattr(getattr(driver, name), "__func__", None) is not original
            for name, original in _SEARCH_PORTS
        )
        or getattr(client._request, "__func__", None) is not _REQUEST
        or getattr(client._session.stream, "__func__", None) is not _STREAM
        or client._session._transport is not record["transport"]()
        or client._io_lock is not record["io_lock"]()
        or client._write_lock is not record["write_lock"]()
        or worker
        and time.monotonic() >= record["deadline"]
    ):
        raise AccessError("station_changed")
    if worker and asyncio.Task.cancelling(task):
        raise asyncio.CancelledError
    if origin.manager is not None:
        manager = origin.manager()
        source = record["station_owner"]()
        table = record["station_table"]()
        if (
            manager is None
            or manager is not record["manager"]()
            or manager._closed
            or manager.repository is not repo
            or manager.engine is not engine
            or manager.stations is not table
            or table is None
            or table.get(record["station"]) is not source
            or source is None
            or source.id != record["station"]
            or source.driver is not driver
            or not source.lock_enabled
        ):
            raise AccessError("station_changed")


async def observe(engine, station: str, user: ManagedUser, driver: AccessClient) -> AbsenceEvidence:
    """Read users AND cards anew, then bind one current-revision absence fact."""
    from dataclasses import replace

    station_started(engine, station, driver)
    origin = _ENGINES.get(engine)
    task = asyncio.current_task()
    if (
        origin is None
        or type(driver) is not AccessClient
        or not isinstance(task, asyncio.Task)
        or driver._owner is not task
        or type(user) is not ManagedUser
        or type(driver.capabilities) is not AccessCapabilities
    ):
        raise AccessError("readback_unavailable")
    client = driver.client
    state = engine.repository._state
    present = user.id in state["users"]
    raw = (
        state["users"].get(user.id)
        if present
        else state["tombstones"].get(user.id, {}).get("record")
    )
    if (
        raw is None
        or raw["revision"] != user.revision
        or raw["employee_no"] != user.employee_no
        or present
        and raw["active"]
        and raw["assignments"].get(station, {}).get("enabled")
    ):
        raise AccessError("revision_conflict")
    target = station in raw["assignments"] or user.id in state["bindings"].get(station, {})
    target = target or any(
        item["user_id"] == user.id and station in item["targets"]
        for name in ("retired_cards", "retired_pins", "tombstones")
        for item in state[name].values()
    )
    if not target:
        raise AccessError("ownership_missing")
    record = {
        "engine": ref(engine),
        "repository": ref(engine.repository),
        "driver": ref(driver),
        "client": ref(client),
        "session": ref(client._session),
        "transport": ref(client._session._transport),
        "io_lock": ref(client._io_lock),
        "write_lock": ref(client._write_lock),
        "task": ref(task),
        "coroutine": ref(asyncio.Task.get_coro(task)),
        "present": present,
        "station": station,
        "user_id": user.id,
        "revision": user.revision,
        "employee_no": user.employee_no,
        "epoch": origin.stations[station][1],
        "settings": client.settings,
        "settings_values": replace(client.settings),
        "identity": client._expected_identity,
        "doors": client.physical_doors,
        "door_values": dict(client.physical_doors),
        "capabilities": driver.capabilities,
        "capability_values": replace(driver.capabilities),
        "deadline": time.monotonic() + 20,
        "used": False,
    }
    if origin.manager is not None:
        manager = origin.manager()
        if manager is None:
            raise AccessError("station_changed")
        record.update(
            manager=ref(manager),
            station_table=ref(manager.stations),
            station_owner=ref(manager.stations[station]),
        )
    _check(record)
    async with asyncio.timeout(20):
        inventory = await driver.async_person(user.employee_no)
    _check(record)
    if type(inventory) is not StationInventory or inventory.users or inventory.cards:
        raise AccessError("delete_not_verified")
    evidence = AbsenceEvidence()
    _RECEIPTS[evidence] = record
    return evidence


def require(
    evidence,
    repository,
    station: str,
    user_id: str,
    revision: int,
    *,
    employee_no: str,
    present: bool,
    consume=False,
) -> None:
    record = _RECEIPTS.get(evidence) if type(evidence) is AbsenceEvidence else None
    if (
        record is None
        or record["used"]
        or record["repository"]() is not repository
        or record["station"] != station
        or record["user_id"] != user_id
        or type(revision) is not int
        or record["revision"] != revision
        or record["employee_no"] != employee_no
        or record["present"] is not present
    ):
        raise AccessError("readback_unavailable")
    _check(record)
    if consume:
        record["used"] = True


def require_caller(evidence) -> None:
    record = _RECEIPTS.get(evidence) if type(evidence) is AbsenceEvidence else None
    if record is None or record["task"]() is not asyncio.current_task():
        raise AccessError("readback_unavailable")


def require_after_save(evidence) -> None:
    """A consumed receipt still has to belong to the original live mapping."""
    require_caller(evidence)
    record = _RECEIPTS.get(evidence)
    if record is None or record["used"] is not True:
        raise AccessError("readback_unavailable")
    _check(record)


def published(evidence) -> None:
    """Remember the original mapping of an actual, durably committed observation."""
    require_after_save(evidence)
    record = _RECEIPTS[evidence]
    _OBSERVED[record["repository"]()][record["station"], record["user_id"]] = record


def requires_save(evidence) -> bool:
    """Equal images can reuse durability only on the same sealed original epoch.

    This never skips a native read or certifies a newer revision. The repository
    calls it only after consuming the fresh receipt and comparing complete state
    images. A changed source always needs its own save/post-save ownership fence.
    """
    require_after_save(evidence)
    fresh = _RECEIPTS[evidence]
    original = _OBSERVED.get(fresh["repository"](), {}).get((fresh["station"], fresh["user_id"]))
    if original is None:
        return True
    if (
        any(
            original[key] != fresh[key]
            for key in (
                "station",
                "user_id",
                "revision",
                "employee_no",
                "present",
            )
        )
        or original["epoch"] is not fresh["epoch"]
    ):
        return True
    if any(
        original[key]() is not fresh[key]()
        for key in (
            "engine",
            "repository",
            "driver",
            "client",
            "session",
            "transport",
            "io_lock",
            "write_lock",
        )
    ):
        return True
    try:
        _check(original, worker=False)
    except AccessError:
        return True
    _check(fresh)
    return False


def current_snapshot(repository, state: dict) -> dict:
    """Readback never transfers an old mapping's absence fact to its replacement.

    Pure projectors remain usable for detached snapshots. A native engine's
    repository additionally requires its original locally issued observation.
    The original public schema is preserved; UNKNOWN uses existing null fields.
    """
    from copy import deepcopy

    from . import sync_tracking

    observations = _OBSERVED.get(repository)
    if observations is None:
        return state
    stale = []
    for user_id, user in state["users"].items():
        for station, assignment in user["assignments"].items():
            if (
                assignment["enabled"]
                or assignment["applied_revision"] != user["revision"]
                or assignment["sync_state"] != "synced"
            ):
                continue
            record = observations.get((station, user_id))
            try:
                if record is None or record["revision"] != user["revision"]:
                    raise AccessError("readback_unavailable")
                _check(record, worker=False)
            except AccessError:
                stale.append((station, user_id))
    if not stale:
        return state
    snapshot = deepcopy(state)
    for station, user_id in stale:
        expire_disabled(snapshot, station=station, user_id=user_id)
    sync_tracking.update(snapshot)
    return snapshot


def expire_disabled(state: dict, *, station=None, user_id=None) -> bool:
    """An old process/mapping cannot confer current absence proof on a new one.

    No private schema extension: retain genuine durable assignment and cleanup
    targets, but require a new native read before publishing a positive row.
    """
    changed = False
    for key, user in state["users"].items():
        if user_id is not None and key != user_id:
            continue
        for sid, assignment in user["assignments"].items():
            if station is not None and sid != station or assignment["enabled"]:
                continue
            if assignment["applied_revision"] is not None or assignment["sync_state"] == "synced":
                assignment.update(
                    applied_revision=None, sync_state="pending", last_sync_at=None, last_error=None
                )
                changed = True
    return changed
