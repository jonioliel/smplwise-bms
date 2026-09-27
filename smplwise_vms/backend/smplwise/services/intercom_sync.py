"""WisKey entry-center feed (CR-005 phase 1a): one long-lived Home Assistant WebSocket session that keeps a trimmed,
read-only copy of WisKey's `overview` and tells SMPLWISE's own browser clients when it changed.

Mirrors services/ha_sync.py: a background thread, a small state object (`connected`, `last_error`, `reconnects` ...),
subscriber queues fanned out under a lock, and `.start()` / `.shutdown()` wired from main.py.

Refresh sources, the same ones WisKey's own panel relies on (WISKEY_SOURCE_EXTRACTION.md, "Live update behaviour"):
- `hikvision_intercom/subscribe`: data-free `{"kind": "refresh"}` pushes -> refetch `overview`;
  `{"kind": "access_revoked"}` -> the add-on's HA user lost WisKey access; the copy is dropped.
- Home Assistant state pushes for the stations' own `online` / `ringing` / `call_status` entities
  (`subscribe_entities`), which is how WisKey's panel sees ringing without waiting for a poll.
- a 30 s poll, only while someone is looking (WisKey's panel polls `overview` every 30 s while its tab is open and
  visible, panel.ts:492-497): a browser client holds the change-notice socket open, or GET /intercom/overview was asked
  within the last two poll intervals. Every `overview` reply carries WisKey's whole user directory, so nobody watching
  means no polling; the two push sources above keep running regardless.
Refetches are single-flight with coalescing (WisKey's `refresh()` / `_refreshAgain`).

Home Assistant answers WebSocket commands while integrations are still being set up, and WisKey registers its commands
only after its access and event managers are up (`__init__.py:23-45`, WISKEY_SOURCE_EXTRACTION.md 0.1). So an
`unknown_command` reply right after an HA restart is not proof WisKey is absent: the feed asks HA's `get_config` and
concludes `not_installed` only when HA itself is RUNNING (and, after a session that was ready, only after
`ABSENT_AFTER_READY` consecutive probes); until then it stays `connecting` on the normal short backoff and keeps
serving the last-known copy as not fresh.

Honest state: without Home Assistant access, without the WisKey integration, or when WisKey refuses the add-on's user,
the state says so and no station data is served. Only the projection below is ever kept in memory - WisKey's people
list (cards, PIN flags, phones) is dropped the moment the reply arrives; that belongs to a later, separately gated
screen."""
from __future__ import annotations

import asyncio
import logging
import queue
import threading
import time
from collections import deque
from typing import Any

from ..config import Settings
from ..db import now_iso
from ..errors import ApiError
from . import ha_client, intercom_client
from .intercom_client import IntercomError

log = logging.getLogger("smplwise.intercom")

POLL_S = 30.0
VIEW_WINDOW_S = 2 * POLL_S  # a GET within this window counts as someone looking (a socket-less client GETs every 30 s)
RETRY_S = 5.0  # reconnect backoff: 5 s doubling to RETRY_MAX_S
RETRY_MAX_S = 60.0
RETRY_ABSENT_S = 300.0  # WisKey missing or refusing us: re-probe every five minutes, not every few seconds
ABSENT_AFTER_READY = 3  # after a ready session, `unknown_command` with HA RUNNING must repeat this often to mean "removed"
LOADING = "wiskey_loading"  # IntercomError code: HA does not know WisKey's commands yet, but may still be loading it
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
        self._was_ready = False  # a session reached `ready` since the process (or reset()) started
        self._absent_strikes = 0  # consecutive `unknown_command` probes with HA RUNNING, after a ready session
        self._last_view: float | None = None  # monotonic time of the last GET /intercom/overview
        self._fetched_mono: float | None = None
        self._event_loop: asyncio.AbstractEventLoop | None = None
        self._tasks: set[asyncio.Task[None]] = set()  # refreshes started by pushes (_kick); cancelled with the session
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
        self._was_ready = False
        self._absent_strikes = 0
        self._last_view = None
        self._fetched_mono = None
        self._session_reset()
        STATE.reset()

    # -- what the router serves
    def snapshot(self, settings: Settings) -> dict[str, Any]:
        configured = ha_client.configured(settings)
        self._viewed()
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

    def watched(self) -> bool:
        """Someone is looking at the entry center: a change-notice socket is open, or a GET arrived recently."""
        with _sub_lock:
            if _subscribers:
                return True
        seen = self._last_view
        return seen is not None and time.monotonic() - seen < VIEW_WINDOW_S

    def _viewed(self) -> None:
        """A GET arrived. After a stretch with nobody watching (no polling), the copy may be older than one poll:
        refetch now instead of on the next poll tick; the client hears `intercom_refresh` if anything changed."""
        idle = not self.watched()
        self._last_view = time.monotonic()
        loop, fetched = self._event_loop, self._fetched_mono
        # only a ready session: during on_ready's own probe / subscribe a second overview + subscribe_entities would race it
        ready = STATE.state == "ready" and self._call is not None
        if idle and ready and loop is not None and (fetched is None or time.monotonic() - fetched > POLL_S):
            try:
                loop.call_soon_threadsafe(self._kick)
            except RuntimeError:  # the session's loop is already closed
                pass

    def _store(self, raw: dict[str, Any]) -> bool:
        projected = project_overview(raw)
        with self._cache_lock:
            changed = projected != self._cache
            self._cache = projected
        STATE.fetched_at = now_iso()
        self._fetched_mono = time.monotonic()
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
        backoff = RETRY_S
        stop_evt = asyncio.Event()

        async def watch_stop() -> None:
            while not self.stop.is_set():
                await asyncio.sleep(1)
            stop_evt.set()

        asyncio.create_task(watch_stop())
        while not self.stop.is_set():
            delay = backoff
            short = False  # HA is answering but WisKey is still loading: retry soon, whatever the backoff had reached
            try:
                await self._session(stop_evt)
                backoff = RETRY_S
                if STATE.state == "ready":
                    self._set_state("ha_unavailable", "disconnected")
            except IntercomError as exc:
                if exc.code == LOADING:
                    # HA is (re)starting and WisKey is not loaded yet: keep the last-known copy (served as not fresh)
                    # and retry on the normal short backoff
                    self._set_state("connecting", LOADING)
                    delay, short = RETRY_S, True
                elif exc.not_installed or exc.code == "unauthorized":
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
            backoff = RETRY_S if short else min(RETRY_MAX_S, backoff * 2)
        STATE.connected = False

    async def _session(self, stop_evt: asyncio.Event) -> None:
        assert self.settings
        self._session_reset()
        end = asyncio.Event()
        self._end = end
        self._event_loop = asyncio.get_running_loop()
        poller: asyncio.Task[None] | None = None

        async def forward_stop() -> None:
            await stop_evt.wait()
            end.set()

        stopper = asyncio.create_task(forward_stop())

        async def on_ready(call: intercom_client.Call) -> None:
            nonlocal poller
            self._call = call
            try:
                raw = await intercom_client.overview(call)  # the probe: unknown_command = not loaded (yet?)
            except IntercomError as exc:
                if exc.not_installed and await self._maybe_loading(call):
                    raise IntercomError(LOADING, "overview") from exc
                raise
            self._absent_strikes = 0
            self._store(raw)
            await self._watch(call, watched_entities(raw))
            self._wiskey_sub = await intercom_client.subscribe(call)
            self._replay_early()
            STATE.connected = True
            self._was_ready = True
            self._set_state("ready", None)
            self._logged_error = None  # a later repeat of an earlier failure is logged again
            log.info("WisKey feed connected: %d stations, WisKey %s", len((self._cache or {}).get("stations", [])), STATE.wiskey_version)

            async def poll() -> None:
                while not end.is_set():
                    await asyncio.sleep(POLL_S)
                    if self.watched():
                        await self._refresh()

            poller = asyncio.create_task(poll(), name="intercom-poll")

        try:
            await ha_client.ws_session(self.settings, on_ready, lambda _data: None, end, on_message=self._on_message)
        finally:
            self._call = None
            # nothing of this session may outlive it: a stray refresh's own `finally` would otherwise run after the
            # next session reset and break its one-refresh-at-a-time invariant
            tasks = [t for t in (stopper, poller, *self._tasks) if t is not None and not t.done()]
            for t in tasks:
                t.cancel()
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
            self._tasks.clear()
        if self._fault is not None:
            raise self._fault

    async def _maybe_loading(self, call: intercom_client.Call) -> bool:
        """`unknown_command` for WisKey's `overview`: True while that may only mean "not loaded yet" (see the module
        docstring), False once it means "not installed"."""
        # a socket failure here propagates: the session ends as ha_unavailable (the connection is gone), not as loading
        frame = await call("get_config")
        result = frame.get("result") if frame.get("success") else None
        running = isinstance(result, dict) and result.get("state") == "RUNNING"
        if not running:
            return True
        # HA's bootstrap can reach RUNNING past a slow integration's setup: after a ready session, re-probe a few times
        if self._was_ready:
            self._absent_strikes += 1
            return self._absent_strikes < ABSENT_AFTER_READY
        return False

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
        task = asyncio.get_running_loop().create_task(self._refresh(), name="intercom-refresh")
        self._tasks.add(task)  # a strong reference (an unreferenced task can be collected mid-run) ...
        task.add_done_callback(self._tasks.discard)  # ... dropped once it is done

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
        self._watched = set()
        if not ids:
            return
        frame = await call("subscribe_entities", entity_ids=sorted(ids))
        if frame.get("success"):
            self._entities_sub = int(frame["id"])
            self._watched = set(ids)  # only now: a refused subscription is tried again on the next refresh
            self._replay_early()


SYNC = IntercomSync()
