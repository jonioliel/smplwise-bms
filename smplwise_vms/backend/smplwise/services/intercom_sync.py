"""WisKey entry-center feed (CR-005 phase 1a): one long-lived Home Assistant WebSocket session that keeps a trimmed,
read-only copy of WisKey's `overview` and tells SMPLWISE's own browser clients when it changed.

Mirrors services/ha_sync.py: a background thread, a small state object (`connected`, `last_error`, `reconnects` ...),
subscriber queues fanned out under a lock, and `.start()` / `.shutdown()` wired from main.py.

Refresh sources, the same ones WisKey's own panel relies on (WISKEY_SOURCE_EXTRACTION.md, "Live update behaviour"):
- `hikvision_intercom/subscribe`: data-free `{"kind": "refresh"}` pushes -> refetch `overview`;
  `{"kind": "access_revoked"}` -> the add-on's HA user lost WisKey access; the copy is dropped.
- Home Assistant state pushes for the stations' own `online` / `ringing` / `call_status` entities
  (`subscribe_entities`), which is how WisKey's panel sees ringing without waiting for a poll.
- a 30 s poll (WisKey's panel polls `overview` every 30 s while visible, panel.ts:492-497).
Refetches are single-flight with coalescing (WisKey's `refresh()` / `_refreshAgain`).

Honest state: without Home Assistant access, without the WisKey integration, or when WisKey refuses the add-on's user,
the state says so and no station data is served. Only the projection below is ever kept in memory - WisKey's people
list (cards, PIN flags, phones) is dropped the moment the reply arrives; that belongs to a later, separately gated
screen."""
from __future__ import annotations

import asyncio
import logging
import queue
import threading
from collections import deque
from typing import Any

from ..config import Settings
from ..db import now_iso
from ..errors import ApiError
from . import ha_client, intercom_client
from .intercom_client import IntercomError

log = logging.getLogger("smplwise.intercom")

POLL_S = 30.0
RETRY_ABSENT_S = 300.0  # WisKey missing or refusing us: re-probe every five minutes, not every few seconds
STATION_WATCH_KEYS = ("online", "ringing", "call_status")
LAST_ACCESS_KEYS = ("timestamp", "time_source", "person_name", "employee_no", "authentication", "result", "event_type", "recovered", "door")

# ha_not_configured | idle | connecting | ha_unavailable | not_installed | forbidden | error | ready
STATES = ("ha_not_configured", "idle", "connecting", "ha_unavailable", "not_installed", "forbidden", "error", "ready")


class IntercomState:
    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.state = "idle"
        self.connected = False
        self.last_error: str | None = None
        self.reconnects = 0
        self.started_at: str | None = None
        self.fetched_at: str | None = None
        self.refreshes = 0
        self.sequence = 0
        self.wiskey_version: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {k: getattr(self, k) for k in ("state", "connected", "last_error", "reconnects", "started_at", "fetched_at", "refreshes", "sequence", "wiskey_version")}


STATE = IntercomState()
_subscribers: list[queue.Queue] = []
_sub_lock = threading.Lock()


def subscribe() -> queue.Queue:
    q: queue.Queue = queue.Queue(maxsize=100)
    with _sub_lock:
        _subscribers.append(q)
    return q


def unsubscribe(q: queue.Queue) -> None:
    with _sub_lock:
        if q in _subscribers:
            _subscribers.remove(q)


def publish(msg: dict[str, Any]) -> None:
    with _sub_lock:
        subs = list(_subscribers)
    for q in subs:
        try:
            q.put_nowait(msg)
        except queue.Full:
            pass


# ---------------------------------------------------------------- projection

def _int(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _station(raw: dict[str, Any]) -> dict[str, Any]:
    entities = raw.get("entities") if isinstance(raw.get("entities"), dict) else {}
    clock = raw.get("clock") if isinstance(raw.get("clock"), dict) else {}
    last = raw.get("last_access") if isinstance(raw.get("last_access"), dict) else None
    locks = raw.get("integrated_locks") if isinstance(raw.get("integrated_locks"), list) else []
    return {
        "id": str(raw.get("id") or ""),
        "name": str(raw.get("name") or ""),
        "online": bool(raw.get("online")),
        "call_state": str(raw.get("call_state") or "unknown"),
        "sync_state": str(raw.get("sync_state") or "unknown"),
        "lock_enabled": bool(raw.get("lock_enabled")),
        "lock_count": len(locks),
        "has_camera": bool(entities.get("camera")),
        "last_error": raw.get("last_error") if isinstance(raw.get("last_error"), str) else None,
        "last_seen": raw.get("last_seen") if isinstance(raw.get("last_seen"), str) else None,
        "pending_user_count": _int(raw.get("pending_user_count")) or 0,
        "managed_user_count": _int(raw.get("managed_user_count")),
        # the station clock's display zone (WisKey formats a station's last access in it, panel.ts zone())
        "zone": clock.get("zone") if isinstance(clock.get("zone"), dict) else None,
        "last_access": {k: last.get(k) for k in LAST_ACCESS_KEYS} if last else None,
    }


def project_overview(raw: dict[str, Any]) -> dict[str, Any]:
    """What SMPLWISE keeps and serves from WisKey's `overview`: the stations as the entry center shows them, counts,
    and the display zone. Not kept: people, cards, PIN flags, tombstones / revocations, host / model / firmware."""
    stations = [_station(s) for s in raw.get("stations") or [] if isinstance(s, dict)]
    api = raw.get("api") if isinstance(raw.get("api"), dict) else {}
    users = raw.get("users")
    user_count = _int(raw.get("user_count"))
    return {
        "version": raw.get("version") if isinstance(raw.get("version"), str) else None,
        "api_version": _int(api.get("version")),
        "default_zone": raw.get("default_zone") if isinstance(raw.get("default_zone"), dict) else None,
        "user_count": user_count if user_count is not None else (len(users) if isinstance(users, list) else 0),
        "stations": stations,
    }


def watched_entities(raw: dict[str, Any]) -> set[str]:
    out: set[str] = set()
    for s in raw.get("stations") or []:
        entities = s.get("entities") if isinstance(s, dict) and isinstance(s.get("entities"), dict) else {}
        out.update(str(entities[k]) for k in STATION_WATCH_KEYS if entities.get(k))
    return out


# ---------------------------------------------------------------- the session

class IntercomSync:
    def __init__(self) -> None:
        self.thread: threading.Thread | None = None
        self.stop = threading.Event()
        self.settings: Settings | None = None
        self._cache: dict[str, Any] | None = None
        self._cache_lock = threading.Lock()
        self._logged_error: str | None = None
        self._session_reset()

    def _session_reset(self) -> None:
        self._call: intercom_client.Call | None = None
        self._wiskey_sub: int | None = None
        self._entities_sub: int | None = None
        # event frames whose subscription id is not known yet: HA sends a subscription's first event right behind
        # its result, and the socket reader can get to it before the awaiting coroutine has recorded the id
        self._early: deque[dict[str, Any]] = deque(maxlen=20)
        self._watched: set[str] = set()
        self._refreshing = False
        self._again = False
        self._end: asyncio.Event | None = None
        self._fault: BaseException | None = None

    # -- lifecycle (main.py)
    def start(self, settings: Settings) -> None:
        self.settings = settings
        if not ha_client.configured(settings):
            STATE.state = "ha_not_configured"
            STATE.last_error = "ha_not_configured"
            return
        STATE.state = "connecting"
        STATE.started_at = now_iso()
        self.stop.clear()
        self.thread = threading.Thread(target=self._run, name="intercom-sync", daemon=True)
        self.thread.start()

    def shutdown(self) -> None:
        self.stop.set()

    def reset(self) -> None:
        """Forget the cached copy and the counters (a fresh process state; used by tests)."""
        self._drop()
        self._logged_error = None
        self._session_reset()
        STATE.reset()

    # -- what the router serves
    def snapshot(self, settings: Settings) -> dict[str, Any]:
        configured = ha_client.configured(settings)
        state = STATE.state if configured else "ha_not_configured"
        if configured and state == "idle":
            state = "connecting"
        with self._cache_lock:
            cached = self._cache
        overview = cached if state in ("ready", "ha_unavailable", "connecting", "error") else None
        return {
            "state": state,
            "configured": configured,
            # a copy from before a disconnect is served as last-known, never as current
            "fresh": state == "ready" and overview is not None,
            "fetched_at": STATE.fetched_at if overview is not None else None,
            "last_error": STATE.last_error if configured else "ha_not_configured",
            "overview": overview,
            "sync": STATE.as_dict(),
        }

    def _store(self, raw: dict[str, Any]) -> bool:
        projected = project_overview(raw)
        with self._cache_lock:
            changed = projected != self._cache
            self._cache = projected
        STATE.fetched_at = now_iso()
        STATE.refreshes += 1
        STATE.wiskey_version = projected["version"]
        if changed:
            STATE.sequence += 1
            publish({"type": "intercom_refresh", "sequence": STATE.sequence})
        return changed

    def _drop(self) -> None:
        with self._cache_lock:
            self._cache = None

    def _set_state(self, state: str, error: str | None) -> None:
        changed = state != STATE.state
        STATE.state, STATE.last_error = state, error
        if changed:
            publish({"type": "intercom_state", "state": state})

    # -- thread
    def _run(self) -> None:
        asyncio.run(self._loop())

    async def _loop(self) -> None:
        assert self.settings
        backoff = 5.0
        stop_evt = asyncio.Event()

        async def watch_stop() -> None:
            while not self.stop.is_set():
                await asyncio.sleep(1)
            stop_evt.set()

        asyncio.create_task(watch_stop())
        while not self.stop.is_set():
            delay = backoff
            try:
                await self._session(stop_evt)
                backoff = 5.0
                if STATE.state == "ready":
                    self._set_state("ha_unavailable", "disconnected")
            except IntercomError as exc:
                if exc.not_installed or exc.code == "unauthorized":
                    self._drop()
                    self._set_state("not_installed" if exc.not_installed else "forbidden", exc.code)
                    delay = RETRY_ABSENT_S
                else:
                    self._set_state("error", exc.code)
                if STATE.last_error != self._logged_error:  # an absent integration is logged once, not every probe
                    log.warning("WisKey feed: %s (%s)", STATE.state, exc.code)
                    self._logged_error = STATE.last_error
            except Exception as exc:  # noqa: BLE001 - the loop must survive any socket failure
                if self.stop.is_set():
                    break
                code = exc.code if isinstance(exc, ApiError) else type(exc).__name__
                self._set_state("ha_unavailable", code)
                log.warning("WisKey feed disconnected: %s (retry in %.0fs)", code, delay)
            if STATE.connected:
                STATE.reconnects += 1
            STATE.connected = False
            try:
                await asyncio.wait_for(stop_evt.wait(), timeout=delay)
            except asyncio.TimeoutError:
                pass
            backoff = min(60.0, backoff * 2)
        STATE.connected = False

    async def _session(self, stop_evt: asyncio.Event) -> None:
        assert self.settings
        self._session_reset()
        end = asyncio.Event()
        self._end = end
        poller: asyncio.Task[None] | None = None

        async def forward_stop() -> None:
            await stop_evt.wait()
            end.set()

        stopper = asyncio.create_task(forward_stop())

        async def on_ready(call: intercom_client.Call) -> None:
            nonlocal poller
            self._call = call
            raw = await intercom_client.overview(call)  # the probe: unknown_command = WisKey is not installed
            self._store(raw)
            await self._watch(call, watched_entities(raw))
            self._wiskey_sub = await intercom_client.subscribe(call)
            self._replay_early()
            STATE.connected = True
            self._set_state("ready", None)
            log.info("WisKey feed connected: %d stations, WisKey %s", len((self._cache or {}).get("stations", [])), STATE.wiskey_version)

            async def poll() -> None:
                while not end.is_set():
                    await asyncio.sleep(POLL_S)
                    await self._refresh()

            poller = asyncio.create_task(poll(), name="intercom-poll")

        try:
            await ha_client.ws_session(self.settings, on_ready, lambda _data: None, end, on_message=self._on_message)
        finally:
            stopper.cancel()
            if poller is not None:
                poller.cancel()
            self._call = None
        if self._fault is not None:
            raise self._fault

    def _replay_early(self) -> None:
        early = list(self._early)
        self._early.clear()
        for msg in early:
            self._on_message(msg)

    def _on_message(self, msg: dict[str, Any]) -> None:
        mid = msg.get("id")
        event = msg.get("event") if isinstance(msg.get("event"), dict) else {}
        if mid is None or mid not in (self._wiskey_sub, self._entities_sub):
            self._early.append(msg)
            return
        if mid == self._wiskey_sub:
            kind = event.get("kind")
            if kind == "refresh":
                self._kick()
            elif kind == "access_revoked":
                self._fail(IntercomError("unauthorized", "subscribe"))
        elif mid == self._entities_sub:
            # subscribe_entities also opens with the current states; that costs one coalesced refetch, and clients
            # are only told when the projection actually changed
            self._kick()

    def _kick(self) -> None:
        asyncio.get_event_loop().create_task(self._refresh())

    def _fail(self, exc: BaseException) -> None:
        self._fault = exc
        if self._end is not None:
            self._end.set()

    async def _refresh(self) -> None:
        """Single-flight overview refetch; a request that arrives meanwhile runs once more afterwards."""
        call = self._call
        if call is None:
            return
        if self._refreshing:
            self._again = True
            return
        self._refreshing = True
        try:
            while True:
                self._again = False
                raw = await intercom_client.overview(call)
                self._store(raw)
                await self._watch(call, watched_entities(raw))
                if not self._again:
                    break
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 - end the session; the loop reconnects and re-probes
            self._fail(exc)
        finally:
            self._refreshing = False

    async def _watch(self, call: intercom_client.Call, ids: set[str]) -> None:
        """Follow the stations' own online / ringing / call-status entities (re-subscribed when that set changes)."""
        if ids == self._watched:
            return
        if self._entities_sub is not None:
            await call("unsubscribe_events", subscription=self._entities_sub)
            self._entities_sub = None
        self._watched = set(ids)
        if not ids:
            return
        frame = await call("subscribe_entities", entity_ids=sorted(ids))
        if frame.get("success"):
            self._entities_sub = int(frame["id"])
            self._replay_early()


SYNC = IntercomSync()
