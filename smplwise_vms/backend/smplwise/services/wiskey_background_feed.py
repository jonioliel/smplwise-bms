"""WisKey background (read) channel, split from the service channel (B0, decisions D-004 and D-006).

The service session (services/intercom_sync.py: SUPERVISOR_TOKEN, an administrator identity) carries the existing writes
(door release, call signal, TTS, people, card capture) and the one-off reads. `BackgroundFeed` is a second, read-only
session with its own token (`wiskey_background_token`: the dedicated non-administrator account the OWNER creates after B0),
its own connection and therefore its own WisKey rate bucket. It sends `overview` and `subscribe` and, for the diagnostics,
`authorization/session`; it has no action path, so no write can ever ride it. What it keeps is the closed D-006 projection
(services/wiskey_background.py), built by explicit construction, held in memory only.

Until a token is configured the feed does not run: the closed projection is derived from the service feed's copy and every
reply says `identity: "service"` / `split: false`, so nobody mistakes the shared identity for the dedicated one.

The session mirrors the service feed's honest states (`connecting`, `ha_unavailable`, `not_installed`, `forbidden`, `error`,
`ready`); the last-known copy is served as not fresh while disconnected and dropped when WisKey refuses the account
(`access_revoked`, `unauthorized`) or is not installed. The token is valid on Home Assistant core only, never on the
Supervisor proxy, so the connection goes to core (`ha_user_auth.core_ws_url`). Nothing here logs a token, a station host
or a person field."""
from __future__ import annotations

import asyncio
import logging
import threading
from typing import Any, Awaitable, Callable

from ..config import Settings
from . import ha_client, intercom_client
from .intercom_client import IntercomError
from .wiskey_background import assert_closed, from_served_copy, project_background
from .wiskey_feed_session import FeedSession

log = logging.getLogger("smplwise.intercom")

SERVED_STATES = ("ready", "ha_unavailable", "connecting", "error")  # the states in which the last-known copy is served
POLL_S = 60.0  # nobody looks at this channel: a slow safety poll behind WisKey's `refresh` pushes
COMMAND_TIMEOUT_S = 15.0
READ_ALLOWLIST = frozenset({"authorization/session"})  # the one-off reads this session may carry (diagnostics only)


class _NotReady(Exception):
    pass


def configured(settings: Settings | None) -> bool:
    """A dedicated background account's token is configured (the channel is split from the service identity)."""
    return bool(settings is not None and settings.wiskey_background_token)


class BackgroundFeed(FeedSession):
    LOG_NAME = "WisKey background feed"
    REFRESH_TASK = "wiskey-background-refresh"

    def __init__(self) -> None:
        super().__init__()  # thread, stop, settings
        self._lock = threading.Lock()
        self._projection: dict[str, Any] | None = None
        self._command_slot = threading.BoundedSemaphore(1)
        self._reset_status()
        self._session_reset()

    def _reset_status(self) -> None:
        self.status: dict[str, Any] = {
            "state": "not_configured", "last_error": None, "connected": False, "reconnects": 0, "refreshes": 0,
            "fetched_at": None, "wiskey_version": None, "api_version": None, "subscribe": "not_attempted", "sequence": 0,
        }
        self._logged_error = None
        self._was_ready = False
        self._absent_strikes = 0

    def _session_reset(self) -> None:
        self._reset_session_skeleton()  # _call, _early, _refreshing, _again, _end, _fault
        self._loop: asyncio.AbstractEventLoop | None = None
        self._sub: int | None = None
        self._tasks = set()

    # -- lifecycle (main.py)
    def start(self, settings: Settings) -> None:
        self.settings = settings
        if not configured(settings):
            self.status["state"] = "not_configured"
            return
        self.status["state"] = "connecting"
        self._start_thread("wiskey-background")

    def reset(self) -> None:
        """Forget the copy and the counters (a fresh process state; used by tests)."""
        with self._lock:
            self._projection = None
        self._reset_status()
        self._session_reset()

    # -- what the router serves
    def view(self, settings: Settings | None) -> dict[str, Any]:
        """The channel as GET /intercom/background serves it. `projection` is the closed D-006 shape or None."""
        state = self.status["state"] if configured(settings) else "not_configured"
        with self._lock:
            held = self._projection
        served = copy_of(held) if held is not None and state in SERVED_STATES else None
        return {
            "state": state,
            "configured": configured(settings),
            "split": True,
            "identity": "background",
            "fresh": state == "ready" and served is not None,
            "fetched_at": self.status["fetched_at"] if served is not None else None,
            "last_error": self.status["last_error"],
            "projection": served,
            "sync": {k: self.status[k] for k in ("state", "connected", "reconnects", "refreshes", "sequence", "wiskey_version", "subscribe")},
        }

    # -- one-off reads (diagnostics)
    def command(self, command: str, send: Callable[[intercom_client.Call], Awaitable[Any]], timeout: float = COMMAND_TIMEOUT_S) -> tuple[str, Any]:
        """Run one allow-listed read over the live session. Returns `("ok", result)` or `(code, None)` where code is the
        feed's state (`not_configured`, `connecting`, ...), `busy`, `timeout`, or WisKey's own error code. Never queued,
        never retried."""
        if command not in READ_ALLOWLIST:
            raise ValueError(f"{command} is not an allowed background read")
        loop, call = self._loop, self._call
        if self.status["state"] != "ready" or loop is None or call is None:
            return self.status["state"], None
        if not self._command_slot.acquire(blocking=False):
            return "busy", None
        try:
            future = asyncio.run_coroutine_threadsafe(self._one_off(send), loop)
            try:
                return "ok", future.result(timeout=timeout)
            except TimeoutError:
                future.cancel()
                return "timeout", None
            except _NotReady:
                return "connecting", None
            except IntercomError as exc:
                return exc.code, None
            except Exception:  # noqa: BLE001 - the socket went away mid-request
                return "ha_unavailable", None
        finally:
            self._command_slot.release()

    async def _one_off(self, send: Callable[[intercom_client.Call], Awaitable[Any]]) -> Any:
        call = self._call
        if call is None or self.status["state"] != "ready":
            raise _NotReady()
        return await send(call)

    # -- projection
    def _store(self, raw: dict[str, Any]) -> bool:
        projection = project_background(raw)
        try:
            assert_closed(projection)  # defence in depth: nothing that is not the closed shape is ever held
        except ValueError:
            log.warning("WisKey background feed: a projection failed the closed-shape check and was not kept")
            return False
        api = raw.get("api") if isinstance(raw.get("api"), dict) else {}
        version = api.get("version")
        with self._lock:
            before = self._projection
            changed = before is None or {k: v for k, v in before.items() if k != "generated_at"} != {k: v for k, v in projection.items() if k != "generated_at"}
            self._projection = projection
        self.status["fetched_at"] = projection["generated_at"]
        self.status["refreshes"] += 1
        self.status["wiskey_version"] = raw["version"] if isinstance(raw.get("version"), str) else None
        self.status["api_version"] = version if isinstance(version, int) and not isinstance(version, bool) else None
        if changed:
            self.status["sequence"] += 1
        return changed

    def _drop(self) -> None:
        with self._lock:
            self._projection = None

    def _set_state(self, state: str, error: str | None) -> None:
        self.status["state"], self.status["last_error"] = state, error

    # -- the reconnect ladder's view of this feed's state (wiskey_feed_session.FeedSession._ladder)
    def _feed_state(self) -> str:
        return self.status["state"]

    def _feed_error(self) -> str | None:
        return self.status["last_error"]

    def _feed_connected(self) -> bool:
        return self.status["connected"]

    def _set_connected(self, value: bool) -> None:
        self.status["connected"] = value

    def _count_reconnect(self) -> None:
        self.status["reconnects"] += 1

    def _refused_token(self) -> str | None:
        assert self.settings
        return self.settings.wiskey_background_token

    async def _session(self, stop_evt: asyncio.Event) -> None:
        from . import intercom_sync as sync
        from .ha_user_auth import core_ws_url

        assert self.settings
        settings = self.settings
        token = settings.wiskey_background_token
        self._session_reset()
        end = asyncio.Event()
        self._end = end
        self._loop = asyncio.get_running_loop()
        poller: asyncio.Task[None] | None = None
        url = await asyncio.to_thread(core_ws_url, settings)  # the token is valid on HA core only (never on the proxy)

        async def forward_stop() -> None:
            await stop_evt.wait()
            end.set()

        stopper = asyncio.create_task(forward_stop())

        async def on_ready(call: intercom_client.Call) -> None:
            nonlocal poller
            from . import wiskey_channels

            call = wiskey_channels.guard(call, "background")  # overview, subscribe, authorization/session and get_config only
            self._call = call
            try:
                raw = await intercom_client.overview(call)  # the probe: unknown_command = not loaded (yet?)
            except IntercomError as exc:
                if exc.not_installed and await self._maybe_loading(call):
                    raise IntercomError(sync.LOADING, "overview") from exc
                raise
            self._absent_strikes = 0
            self._store(raw)
            try:
                self._sub = await intercom_client.subscribe(call)
                self.status["subscribe"] = "ok"
            except IntercomError as exc:  # polling still keeps the copy current; the diagnostics show why there is no push
                self.status["subscribe"] = f"failed:{exc.code}"
            self._replay_early()
            self.status["connected"] = True
            self._was_ready = True
            self._set_state("ready", None)
            self._logged_error = None
            log.info("WisKey background feed connected: %d stations, WisKey %s", len((self._projection or {}).get("stations", [])), self.status["wiskey_version"])

            async def poll() -> None:
                while not end.is_set():
                    await asyncio.sleep(POLL_S)
                    await self._refresh()

            poller = asyncio.create_task(poll(), name="wiskey-background-poll")

        try:
            await ha_client.ws_session(settings, on_ready, lambda _data: None, end, on_message=self._on_message, url=url, token=token, internal_tls=True)
        finally:
            self._call = None
            if self.status["state"] != "ready":
                self.status["subscribe"] = "not_attempted"
            tasks = [t for t in (stopper, poller, *self._tasks) if t is not None and not t.done()]
            for t in tasks:
                t.cancel()
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
            self._tasks.clear()
        if self._fault is not None:
            raise self._fault

    def _on_message(self, msg: dict[str, Any]) -> None:
        mid = msg.get("id")
        event = msg.get("event") if isinstance(msg.get("event"), dict) else {}
        if mid is None or mid != self._sub:
            self._early.append(msg)
            return
        kind = event.get("kind")
        if kind == "refresh":
            self._kick()
        elif kind == "access_revoked":
            self._fail(IntercomError("unauthorized", "subscribe"))
        elif kind == "screen_locked":
            self._fail(IntercomError("screen_locked", "subscribe"))

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
                self._store(await intercom_client.overview(call))
                if not self._again:
                    break
        except asyncio.CancelledError:
            raise
        except IntercomError as exc:
            if exc.code != "rate_limited":  # a spent WisKey bucket is temporary: keep the session, the poll tries again
                self._fail(exc)
        except Exception as exc:  # noqa: BLE001 - end the session; the loop reconnects and re-probes
            self._fail(exc)
        finally:
            self._refreshing = False


def copy_of(projection: dict[str, Any]) -> dict[str, Any]:
    """A detached copy of a closed projection (what is served is never the object that is held)."""
    return {**projection, "stations": [dict(s) for s in projection["stations"]]}


FEED = BackgroundFeed()


def channel_view(settings: Settings) -> dict[str, Any]:
    """GET /intercom/background: the split session's closed projection when a background account is configured, else the
    closed projection of the service feed's copy (`identity: "service"`, `split: false`). Never anything else."""
    if configured(settings):
        return FEED.view(settings)
    from . import intercom_sync

    state, served = intercom_sync.SYNC.served(settings)
    projection = from_served_copy(served)
    st = intercom_sync.STATE
    return {
        "state": state,
        "configured": ha_client.configured(settings),
        "split": False,
        "identity": "service",
        "fresh": state == "ready" and projection is not None,
        "fetched_at": st.fetched_at if projection is not None else None,
        "last_error": st.last_error if ha_client.configured(settings) else "ha_not_configured",
        "projection": projection,
        "sync": {"state": st.state, "connected": st.connected, "reconnects": st.reconnects, "refreshes": st.refreshes, "sequence": st.sequence,
                 "wiskey_version": st.wiskey_version, "subscribe": "n/a"},
    }
