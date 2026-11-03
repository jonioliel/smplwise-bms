"""Admin-only same-origin binary MSE bridge; source URLs stay inside HA."""

from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass
from typing import Any

from aiohttp import WSMsgType, web
from homeassistant.components.http import HomeAssistantView
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import HomeAssistant, callback

from .access.models import AccessError
from .client.video_tracks import VideoOnlyMP4
from .const import DOMAIN
from .media_api import provider, settings
from .media_lifetime import JoinedExit, close_owned, closing_owner, is_closing_owner, join_owned
from .panel_permissions import area_allowed, station_allowed

CODECS = frozenset(
    {
        "avc1.640029",
        "avc1.64002A",
        "avc1.640033",
        "hvc1.1.6.L153.B0",
        "mp4a.40.2",
        "mp4a.40.5",
        "flac",
        "opus",
    }
)
MAX_MESSAGE = 4 * 1024 * 1024
MIME = re.compile(
    r'^video/mp4; codecs="(?:avc1|hvc1|hev1)[A-Za-z0-9.]+'
    r'(?:, ?(?:mp4a\.[A-Za-z0-9.]+|flac|opus))?"$'
)


def _allowed(permissions, user, station_id, permit):
    if permit is not None:
        from .access.arx_media_execution import NativeMediaPermit

        if type(permit) is NativeMediaPermit and NativeMediaPermit.bridge_authorized(
            permit,
            user=user,
            station_id=station_id,
        ):
            return True
    return station_allowed(permissions, user, station_id) and (
        area_allowed(permissions, user, "overview", "view")
        or area_allowed(permissions, user, "stations", "view")
    )


@dataclass(frozen=True, repr=False)
class _MSEOwner:
    hass: Any
    active: set
    finished: Any
    tasks: dict
    closing: list
    requests: dict


@dataclass(frozen=True, repr=False)
class _MSERequestOwner:
    runtime: Any
    task: list
    life: list
    finished: Any


class _MSERequest:
    """One runtime-owned HTTP request, retired after its original I/O cleanup."""

    def __init__(self, runtime: Any):
        # Entered / closing / cancellation requested are distinct facts.
        self._creation = _MSERequestOwner(
            runtime, [asyncio.current_task()], [True, False, False], asyncio.Event()
        )
        try:
            runtime._own_media(self)
            runtime._track_media_task(self)
        except BaseException:
            self.finish()
            raise

    def begin_close(self) -> None:
        self._creation.life[1] = True

    def finish(self) -> None:
        owner = self._creation
        owner.life[1] = True
        try:
            owner.runtime._retire_media(self, owner)
        finally:
            owner.finished.set()

    async def async_close(self) -> None:
        owner = self._creation
        owner.life[1] = True
        task = owner.task[0]
        if owner.finished.is_set() or is_closing_owner(owner) or task is asyncio.current_task():
            return
        if not owner.life[2]:
            owner.life[2] = True
            task.cancel()
        _result, cancelled = await join_owned(owner.finished.wait())
        if cancelled:
            raise asyncio.CancelledError


class _FeatureExit(JoinedExit):
    """Record completed original provider cleanup even under caller cancellation."""

    completed = False

    async def __aexit__(self, exc_type, exc, traceback):
        result, cancelled = await close_owned(
            self._owner, self._exit(self._manager, exc_type, exc, traceback)
        )
        self.completed = True
        if cancelled:
            raise asyncio.CancelledError
        return result


class MSEView(HomeAssistantView):
    url = "/api/hikvision_intercom/mse/{station_id}"
    name = "api:hikvision_intercom:mse"
    requires_auth = True

    def __init__(self, hass: HomeAssistant):
        self.hass = hass
        self.active: set[web.WebSocketResponse] = set()
        self.finished = asyncio.Event()
        self.finished.set()
        self._creation = _MSEOwner(hass, self.active, self.finished, {}, [False, None], {})

    def _view_current(self) -> bool:
        o = self._creation
        return (
            self.hass is o.hass
            and self.active is o.active
            and self.finished is o.finished
            and not o.closing[0]
            and o.hass.data.get(DOMAIN, {}).get("mse_view") is self
        )

    async def get(self, request: web.Request, station_id: str) -> web.StreamResponse:
        return await self._serve(request, station_id)

    async def serve_feature(self, request, station_id, permit):
        from .access.arx_media_execution import NativeMediaPermit

        if type(permit) is not NativeMediaPermit:
            raise AccessError("mse_session_changed")
        return await self._serve(request, station_id, permit=permit)

    async def _serve(self, request, station_id, *, permit=None):
        o = self._creation
        if not self._view_current():
            raise web.HTTPServiceUnavailable()
        hass = o.hass
        from .arx_media_ingress import request_subject

        user = request_subject(request) if permit is not None else request.get("hass_user")

        def same_subject():
            actual = request_subject(request) if permit is not None else request.get("hass_user")
            return actual is user

        user_id = getattr(user, "id", None)
        permissions = hass.data[DOMAIN].get("panel_permissions")
        if not _allowed(permissions, user, station_id, permit):
            raise web.HTTPForbidden()
        entry = hass.config_entries.async_get_entry(station_id)
        runtime = getattr(entry, "runtime_data", None) if entry and entry.domain == DOMAIN else None
        if runtime is None or runtime.is_closed or not runtime.profile.stream:
            raise web.HTTPNotFound()
        if len(o.active) >= 12:
            raise web.HTTPTooManyRequests()
        settings_port, provider_port = settings, provider
        policy_owner = settings_port(hass)
        policy = policy_owner.public()
        if policy["transport"] != "webrtc" or policy["webrtc_mode"] != "mse":
            raise web.HTTPConflict()
        revision = policy["revision"]
        client = runtime.client
        client_ports = tuple(
            getattr(client, name, None) for name in ("_session", "settings", "_expected_identity")
        )
        provider_owner: list[Any] = [None]
        scope: _MSERequest | None = None
        codecs = (
            CODECS
            if permit is None
            else frozenset(c for c in CODECS if c.startswith(("avc1.", "hvc1.")))
        )
        tracks = VideoOnlyMP4() if permit is not None else None

        def current() -> None:
            if permit is not None:
                permit.check_video(request, self, runtime)
            if (
                (scope is not None and scope._creation.life[1])
                or not self._view_current()
                or not same_subject()
                or type(user_id) is not str
                or getattr(user, "id", None) != user_id
                or hass.data[DOMAIN].get("panel_permissions") is not permissions
                or settings is not settings_port
                or provider is not provider_port
            ):
                raise AccessError("mse_session_changed")
            latest_entry = hass.config_entries.async_get_entry(station_id)
            if (
                latest_entry is None
                or latest_entry.domain != DOMAIN
                or getattr(latest_entry, "runtime_data", None) is not runtime
                or runtime.is_closed
                or not runtime.profile.stream
                or runtime.client is not client
                or any(
                    old is not new
                    for old, new in zip(
                        client_ports,
                        (
                            getattr(client, name, None)
                            for name in ("_session", "settings", "_expected_identity")
                        ),
                        strict=True,
                    )
                )
            ):
                raise AccessError("mse_session_changed")
            latest_owner = settings_port(hass)
            if latest_owner is not policy_owner:
                raise AccessError("mse_session_changed")
            latest = latest_owner.public()
            if (
                latest["revision"] != revision
                or latest["transport"] != "webrtc"
                or latest["webrtc_mode"] != "mse"
                or not _allowed(permissions, user, station_id, permit)
            ):
                raise AccessError("mse_session_changed")
            if provider_owner[0] is not None:
                fresh_session, fresh_url = provider_port(hass)
                if fresh_session is not provider_owner[0][0] or fresh_url != provider_owner[0][1]:
                    raise AccessError("mse_session_changed")
            # Metadata calls above may replace an owner. Recheck original
            # identities before exposing a MIME header or binary media chunk.
            if (
                (scope is not None and scope._creation.life[1])
                or not self._view_current()
                or not same_subject()
                or getattr(user, "id", None) != user_id
                or hass.data[DOMAIN].get("panel_permissions") is not permissions
                or settings is not settings_port
                or provider is not provider_port
                or settings_port(hass) is not policy_owner
                or runtime.client is not client
                or any(
                    old is not new
                    for old, new in zip(
                        client_ports,
                        (
                            getattr(client, name, None)
                            for name in ("_session", "settings", "_expected_identity")
                        ),
                        strict=True,
                    )
                )
            ):
                raise AccessError("mse_session_changed")
            # Provider/settings metadata callbacks can also change the same
            # user's role flags. Identity alone is not fresh authorization.
            if (
                not _allowed(permissions, user, station_id, permit)
                or (scope is not None and scope._creation.life[1])
                or not self._view_current()
                or not same_subject()
                or getattr(user, "id", None) != user_id
                or hass.data[DOMAIN].get("panel_permissions") is not permissions
            ):
                raise AccessError("mse_session_changed")
            if permit is not None:
                permit.check_video(request, self, runtime)

        # Continuous video, bounded upstream reads and downstream writes detect stalls.
        # Avoid aiohttp heartbeat timers racing with concurrent receive/close.
        ws = web.WebSocketResponse(max_msg_size=1024)
        if permit is not None:
            from .arx_media_ingress import observe_native_response

            observe_native_response(request, self, runtime, ws, permit)
        o.active.add(ws)
        o.tasks[ws] = asyncio.current_task()
        o.finished.clear()
        tasks: list[asyncio.Task[Any]] = []
        upstream_exit, downstream_closed = None, False
        try:
            current()
            scope = _MSERequest(runtime)
            o.requests[ws] = scope
            await ws.prepare(request)
            current()
            async with asyncio.timeout(10):
                greeting = await ws.receive_json()
            current()
            if (
                not isinstance(greeting, dict)
                or set(greeting) != {"codecs"}
                or not isinstance(greeting["codecs"], list)
                or not greeting["codecs"]
                or len(greeting["codecs"]) > len(codecs)
                or any(not isinstance(c, str) or c not in codecs for c in greeting["codecs"])
            ):
                raise AccessError("mse_protocol_error")
            session, url = provider_port(hass)
            provider_owner[0] = (session, url)
            current()
            # go2rtc GetOrPatch accepts an RTSP source without persisting configuration.
            source = client.settings.rtsp_source()
            current()
            async with asyncio.timeout(10):
                upstream = await session.ws_connect(
                    url + "/api/ws", params={"src": source}, max_msg_size=MAX_MESSAGE
                )
            upstream_exit = (_FeatureExit if permit is not None else JoinedExit)(
                upstream, owner=scope._creation
            )
            async with upstream_exit:
                try:
                    # Enter the original resource's cleanup scope before a guard
                    # refuses the connection returned by the preceding await.
                    current()
                    await upstream.send_json({"type": "mse", "value": ",".join(greeting["codecs"])})
                    current()

                    async def forward() -> None:
                        negotiated = False
                        while True:
                            async with asyncio.timeout(12):
                                message = await upstream.receive()
                            current()
                            if message.type == WSMsgType.TEXT:
                                if negotiated or len(message.data) > 1024:
                                    raise AccessError("mse_protocol_error")
                                value = json.loads(message.data)
                                mime = value.get("value") if isinstance(value, dict) else None
                                if not (
                                    isinstance(value, dict)
                                    and value.get("type") == "mse"
                                    and isinstance(mime, str)
                                    and MIME.fullmatch(mime)
                                    and (
                                        permit is None
                                        or not any(
                                            audio in mime for audio in (",", "mp4a", "flac", "opus")
                                        )
                                    )
                                ):
                                    raise AccessError("mse_codec_unavailable")
                                negotiated = True
                                current()
                                await ws.send_json({"type": "mse", "value": mime})
                                current()
                            elif message.type == WSMsgType.BINARY and negotiated:
                                if not message.data or len(message.data) > MAX_MESSAGE:
                                    raise AccessError("mse_protocol_error")
                                # A video-only claim is checked against actual init
                                # track handlers/sample entries and later fragment IDs.
                                # No byte is forwarded before the init proves video.
                                chunks = (
                                    tracks.feed(message.data)
                                    if tracks is not None
                                    else (message.data,)
                                )
                                for chunk in chunks:
                                    if permit is not None:
                                        permit.started_video(request, self, runtime)
                                    async with asyncio.timeout(3):
                                        current()
                                        await ws.send_bytes(chunk)
                                    current()
                            else:
                                raise AccessError("mse_connection_lost")

                    async def watch_client() -> None:
                        async for _message in ws:
                            # No commands or microphone after the codec handshake.
                            raise AccessError("mse_protocol_error")

                    async def watch_owner() -> None:
                        while True:
                            current()
                            await asyncio.sleep(0.5)

                    tasks = [
                        asyncio.create_task(forward()),
                        asyncio.create_task(watch_client()),
                        asyncio.create_task(watch_owner()),
                    ]
                    done, _pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                    for task in done:
                        task.result()
                finally:
                    scope.begin_close()
        except asyncio.CancelledError:
            raise
        except Exception as error:
            # Remote error text can contain RTSP credentials. Only our own codes leave HA.
            code = error.code if isinstance(error, AccessError) else "mse_connection_lost"
            if ws.prepared and not ws.closed:
                try:
                    await ws.send_json({"type": "error", "code": code})
                except (ConnectionError, RuntimeError):
                    pass
        finally:
            if scope is not None:
                scope.begin_close()
            try:
                with closing_owner(scope._creation if scope is not None else None):
                    for task in tasks:
                        task.cancel()
                    _result, cancelled = await join_owned(
                        asyncio.gather(*tasks, return_exceptions=True)
                    )
                    try:
                        if ws.prepared:
                            _result, closing_cancelled = await join_owned(ws.close())
                            downstream_closed = True
                            cancelled = cancelled or closing_cancelled
                    finally:
                        o.active.discard(ws)
                        o.tasks.pop(ws, None)
                        if not o.active:
                            o.finished.set()
                    if cancelled:
                        raise asyncio.CancelledError
            finally:
                if scope is not None:
                    try:
                        scope.finish()
                        if (
                            permit is not None
                            and upstream_exit is not None
                            and upstream_exit.completed
                            and downstream_closed
                        ):
                            permit.finished_video(request, self, runtime)
                            from .arx_media_ingress import observe_native_finished

                            observe_native_finished(request, permit)
                    finally:
                        if o.requests.get(ws) is scope:
                            o.requests.pop(ws, None)
        return ws

    async def stop(self, _event: Any) -> None:
        o = self._creation
        o.closing[0] = True
        caller = asyncio.current_task()
        if o.closing[1] is None:
            # Wait for this view's I/O scopes, not an HTTP caller's unrelated
            # postprocessing. Public active-set replacements are never used.
            requests = tuple(o.requests.values())
            scoped_tasks = {scope._creation.task[0] for scope in requests}
            tasks = {
                task for task in o.tasks.values() if task is not caller and task not in scoped_tasks
            }

            async def finish() -> None:
                for task in tasks:
                    task.cancel()
                # A stop invoked by the original request's provider callback is
                # a cooperative refusal, not external Task cancellation. Mark
                # that scope closing and let its next current() check enter its
                # owned cleanup. Cancelling it from this sibling cleanup task
                # would turn the callback's successful stop into CancelledError.
                for scope in requests:
                    if scope._creation.task[0] is caller:
                        scope.begin_close()
                await asyncio.gather(
                    *(
                        scope.async_close()
                        for scope in requests
                        if scope._creation.task[0] is not caller
                    ),
                    return_exceptions=True,
                )
                await o.finished.wait()

            o.closing[1] = asyncio.create_task(finish())
        owned_cleanup = any(
            type(scope) is _MSERequest and is_closing_owner(scope._creation)
            for scope in o.requests.values()
        )
        if caller in o.tasks.values() or owned_cleanup:
            return
        _result, cancelled = await join_owned(o.closing[1])
        if cancelled:
            raise asyncio.CancelledError


@callback
def register_mse(hass: HomeAssistant) -> None:
    view = MSEView(hass)
    hass.data[DOMAIN]["mse_view"] = view
    hass.http.register_view(view)
    hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, view.stop)
