"""HA hold-open preparation and durable transition engine.

Programs activate through an explicit administrator action. Draft saving never
sends a command. Acknowledgement never proves a physical door state.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from copy import deepcopy
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .commit_tasks import finish_owned_commit
from .models import AccessError, text_field
from .repository import Save
from .schedules import normalize, preview


def policy(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != {"timezone", "schedule"}:
        raise AccessError("invalid_fields")
    zone = text_field(value["timezone"], 64)
    try:
        ZoneInfo(zone)
    except (ZoneInfoNotFoundError, ValueError):
        raise AccessError("invalid_timezone") from None
    return {"timezone": zone, "schedule": normalize(value["schedule"])}


def window(value: dict[str, Any], now: datetime) -> str | None:
    """One token per local date/period; repeated DST hour cannot trigger twice."""
    if now.tzinfo is None:
        raise AccessError("invalid_time")
    data = policy(value)
    local = now.astimezone(ZoneInfo(data["timezone"]))
    date, time = local.strftime("%Y-%m-%d"), local.strftime("%H:%M")
    result = preview(data["schedule"], date, time)
    for period in result["periods"]:
        if period["start"] <= time < period["end"]:
            return f"{date}/{period['start']}/{period['end']}"
    return None


class HoldOpenDrafts:
    """Separate strict storage, immutable schedule copies and revision checks."""

    def __init__(self, save: Save) -> None:
        self.save = save
        self.state: dict[str, Any] = {"schema": 1, "drafts": {}}
        self.lock = asyncio.Lock()

    def load(self, data: Any) -> None:
        if data is None:
            return
        try:
            if (
                not isinstance(data, dict)
                or set(data) != {"schema", "drafts"}
                or type(data["schema"]) is not int
                or data["schema"] != 1
            ):
                raise AccessError("invalid_storage")
            if not isinstance(data["drafts"], dict) or len(data["drafts"]) > 200:
                raise AccessError("invalid_storage")
            for key, item in data["drafts"].items():
                if set(item) != {"station_id", "door", "revision", "policy"}:
                    raise AccessError("invalid_storage")
                if (
                    key != self.key(item["station_id"], item["door"])
                    or type(item["revision"]) is not int
                    or item["revision"] < 1
                ):
                    raise AccessError("invalid_storage")
                policy(item["policy"])
        except (KeyError, TypeError, ValueError, AttributeError):
            raise AccessError("invalid_storage") from None
        self.state = deepcopy(data)

    @staticmethod
    def key(station: str, door: int) -> str:
        if type(door) is not int or door not in (1, 2) or "/" in text_field(station, 128):
            raise AccessError("invalid_fields")
        return f"{station}/{door}"

    def get(self, station: str, door: int) -> dict[str, Any] | None:
        item = self.state["drafts"].get(self.key(station, door))
        return deepcopy(dict(item)) if item is not None else None

    async def remove(self, station: str, door: int, revision: int) -> None:
        key = self.key(station, door)
        async with self.lock:
            old = self.state["drafts"].get(key)
            if old is None or old["revision"] != revision:
                raise AccessError("revision_conflict")
            state = deepcopy(self.state)
            del state["drafts"][key]

            async def commit() -> None:
                await self.save(deepcopy(state))
                self.state = state

            task = asyncio.create_task(commit())
            await finish_owned_commit(task)

    async def update(self, station: str, door: int, revision: int, value: Any) -> dict[str, Any]:
        key, parsed = self.key(station, door), policy(value)
        async with self.lock:
            old = self.state["drafts"].get(key)
            if type(revision) is not int or revision != (old["revision"] if old else 0):
                raise AccessError("revision_conflict")
            if old is None and len(self.state["drafts"]) >= 200:
                raise AccessError("schedule_limit")
            updated = {
                "station_id": station,
                "door": door,
                "revision": revision + 1,
                "policy": parsed,
            }
            state = deepcopy(self.state)
            state["drafts"][key] = updated

            # Cancellation must not leave disk and published state divergent.
            async def commit() -> None:
                await self.save(deepcopy(state))
                self.state = state

            task = asyncio.create_task(commit())
            await finish_owned_commit(task)
            return deepcopy(updated)


class HoldOpenExecutor:
    """Durable per-door worker, enabled only by the guarded program manager.

    Caller must serialize policy changes and supply an identity-bound transport.
    Recreated workers restore normal control before considering another opening.
    Lost open responses never trigger a blind repeat within the same window.
    """

    def __init__(
        self, save: Save, send: Callable[[str], Awaitable[None]], *, commissioned: bool = False
    ) -> None:
        self.save, self.send, self.commissioned = save, send, commissioned
        self.state: dict[str, Any] = {"owned": False, "attempted": None, "status": "idle"}
        self.lock = asyncio.Lock()
        self.recovering = False

    def load(self, state: dict[str, Any]) -> None:
        if (
            set(state) != {"owned", "attempted", "status"}
            or type(state["owned"]) is not bool
            or (
                state["attempted"] is not None
                and (not isinstance(state["attempted"], str) or len(state["attempted"]) > 128)
            )
            or state["status"]
            not in {"idle", "opening", "held_acknowledged", "restoring", "unknown"}
        ):
            raise AccessError("invalid_storage")
        self.state = deepcopy(state)
        self.recovering = state["owned"]

    async def persist(self, **changes: Any) -> None:
        if await HoldOpenExecutor._persist_result(self, **changes):
            raise asyncio.CancelledError

    async def _persist_result(self, **changes: Any) -> bool:
        """Return deferred viewer cancellation only after original save success."""
        candidate = {**self.state, **changes}

        async def commit() -> None:
            await self.save(deepcopy(candidate))
            self.state = candidate

        task = asyncio.create_task(commit())
        try:
            await finish_owned_commit(task)
        except asyncio.CancelledError:
            # A cancelled/failed save is unproven; successful original commit
            # remains proven even when its waiting viewer was cancelled.
            if task.done() and not task.cancelled() and task.exception() is None:
                return True
            raise
        return False

    async def tick(self, desired_window: str | None) -> None:
        if not self.commissioned:
            raise AccessError("schedule_writes_unverified")
        async with self.lock:
            if self.state["owned"] and (
                self.recovering
                or desired_window != self.state["attempted"]
                or self.state["status"] != "held_acknowledged"
            ):
                await HoldOpenExecutor._restore_owned(self)
                return
            if (
                desired_window is None
                or self.state["owned"]
                or desired_window == self.state["attempted"]
            ):
                return
            await self.persist(owned=True, attempted=desired_window, status="opening")
            try:
                await self.send("alwaysOpen")
            except Exception:
                await self.persist(status="unknown")
                raise
            await self.persist(status="held_acknowledged")

    async def close_owned(self) -> None:
        """Cleanup only, using an already durable ``owned=True`` barrier.

        HA may refuse new storage writes while stopping. That must not suppress
        the close attempt for an already owned hold. Only native close ACK and a
        successful final save erase the durable recovery obligation. A failed
        final save leaves the prior durable owned state and a local UNKNOWN.
        The caller must stop admission and join its admitted worker first.
        """
        if not self.commissioned:
            raise AccessError("schedule_writes_unverified")
        async with self.lock:
            if self.state["owned"]:
                await HoldOpenExecutor._restore_owned(self)

    async def _restore_owned(self) -> None:
        """Caller holds the worker lock and the durable owned recovery barrier."""
        cancelled = False
        try:
            await self.persist(status="restoring")
        except asyncio.CancelledError:
            cancelled = True
        except Exception:
            # The older owned=True image remains the write-ahead barrier.
            pass
        try:
            await self.send("close")
            cancelled |= await HoldOpenExecutor._persist_result(self, owned=False, status="idle")
        except BaseException:
            self.state = {**self.state, "owned": True, "status": "unknown"}
            try:
                await self.persist(owned=True, status="unknown")
            except (Exception, asyncio.CancelledError):
                pass
            raise
        self.recovering = False
        if cancelled:
            raise asyncio.CancelledError
