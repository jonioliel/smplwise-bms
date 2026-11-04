"""WKINT-295: the JOIN of the four WisKey round-4 branches - WisKey's direct API transport (WKDIRECT-295) behind the two ports the
other branches were written against, and their installation behind ONE selection rule.

    WiskeyCommandPort  (services/wiskey_command_port.py, WKWRITE-295)  async send_signed(command, parameters, *, operation_id)
    WiskeyDirectPort   (services/wiskey_capture_port.py, WKCAP-295)    sync identity() / call() / media_ingress_header() / open_media()

Both adapters share one `DirectCommandSession`: ONE authenticated direct socket (`DirectApiTransport.connect("command")`, hello +
signed `direct/connect` + the server-issued `arx-service:<entry>` subject) that lives on a private event loop (`LoopThread`, the one
WKDIRECT already uses for the synchronous video calls). Every request goes through `DirectLink.call_command`: the closed signed
envelope (`wiskey-peer-query.v1` for `PEER_QUERY_COMMANDS`, else `wiskey-bridge-command.v1`), the command WITHOUT the
`hikvision_intercom/` prefix, the reply's MAC + connection_ref verified by the link's reader and its id here, before any byte of the
result is read. The link is reopened only BETWEEN requests (a request never moves to a new connection; nothing is retried). The
name_ref prepare/apply pair therefore rides the same connection unless the connection itself died between them - then apply fails
(`name_ref_unknown` / closed), it is never re-prepared here.

Outcome mapping (exactly the WKWRITE reply contract):
    not_sent  - only when no byte of the frame was written (link closed before the write, full queue, unsignable, no key, socket
                could not be opened or authenticated for this request);
    refused   - only a verified error frame for this id (WisKey's code as sent);
    unknown   - everything else (send failure mid-write, timeout, connection lost, unverifiable or malformed frame, cancellation).

Sync/async: the async port, when awaited on another loop (the feed's loop, a FastAPI loop), hands the coroutine to the session loop
with `run_coroutine_threadsafe` and awaits it through `asyncio.wrap_future` (shielded: a caller's timeout never cancels a request
mid-write) - the caller's loop is never blocked. The sync port blocks ONLY its calling thread (the capture lease worker, template and
emergency threads); called on the session loop itself it refuses `not_sent` instead of dead-locking.

SELECTION RULE (the AutoTransport rule, nothing looser): the direct path is used only while
    (1) the installation chose `access.station_media_provider = auto` (an Arx switch, default `local`; WKINT changes no default),
    (2) the pairing key signs (present, readable, not rotated), and
    (3) the direct socket opens and authenticates; after a failed attempt the next one waits `RETRY_DIRECT_S` (60 s, as AutoTransport).
Otherwise the EXISTING path runs exactly as before: the capture lease keeps `lease_events.BridgeLeaseTransport`, the template send keeps
`UnwiredTransport`, the people-write routes keep the Home Assistant feed. With no usable key (or `local`) `startup` installs NOTHING:
no lineage file, no anchor row, no transport object, no thread.

Status (honest): implemented and tested against the in-memory fake direct server of tests/w10_fake_direct.py (tests/test_wkjoin_295.py).
NOT run against a real WisKey, Home Assistant or station; nothing installed or live on any installation.
"""
from __future__ import annotations

import asyncio
import json
import logging
import threading
import time
from collections.abc import Awaitable, Callable
from typing import Any, Mapping

from . import wiskey_direct_catalog as catalog
from . import wiskey_media_bridge as bridge
from .wiskey_capture_port import PortError, PortIdentity
from .wiskey_command_port import NOT_SENT, REFUSED, UNKNOWN, WiskeyCommandError
from .wiskey_direct_discovery import CAPABILITIES, TIME, DirectDiscovery

log = logging.getLogger("smplwise.wiskey.direct_join")

DEFAULT_TIMEOUT_S = 10.0
RUN_MARGIN_S = 5.0  # the sync wait above the request's own timeout (the request ends itself first; this only bounds a stuck loop)
MEDIA_PATH_PREFIX = "/api/hikvision_intercom/arx_bridge/v1/media/"
MEDIA_INGRESS_COMMAND = "features/media_ingress_v1"
DISCOVERY_TIMEOUT_S = 6.0
DISCOVERY_COMMANDS = frozenset({CAPABILITIES, TIME})
STOPPED_CODE = "join_stopped"  # WISKEY-JOIN-LIVE-2382: a request after the runtime stop began (not_sent: nothing was written)


def _close_coro(coro: Any) -> None:
    close = getattr(coro, "close", None)
    if close is not None:
        try:
            close()
        except Exception:  # noqa: BLE001
            pass


def envelope_kind(command: str) -> str:
    """WKR5-295: the signed bridge.kind per command from the catalog row (W5-API-01), never from capabilities' `envelope`. A command
    whose catalog wire is not the direct envelope never gets here (`catalog.direct_refusal`)."""
    return catalog.envelope_for(command) or bridge.KIND


# ---------------------------------------------------------------- the shared session

class DirectCommandSession:
    """One direct command connection on one private loop. `connect_ready()` is the (3) part of the selection rule."""

    RETRY_DIRECT_S = 60.0

    def __init__(self, transport: bridge.DirectApiTransport, *, runner: bridge.LoopThread | None = None,
                 clock: Callable[[], float] = time.monotonic,
                 media_opener: Callable[[str, Mapping[str, str], float], Awaitable[Any]] | None = None) -> None:
        self.transport = transport
        self.runner = runner or bridge.LoopThread()
        self._clock = clock
        self._link: bridge.DirectLink | None = None
        self._lock: asyncio.Lock | None = None
        self._down_until = 0.0
        self.last_error: str | None = None
        self.media_opener = media_opener
        # WKR5-295: direct/capabilities + direct/time of the CURRENT connection. With `require_discovery` (set by DirectJoin) a command
        # is written only when this connection's discovery lists it and the clock observation admits Arx's signing window.
        self.discovery = DirectDiscovery()
        self.require_discovery = False
        self._discovery_lock: asyncio.Lock | None = None
        # WISKEY-JOIN-LIVE-2382: a runtime stop. Once `begin_close()` ran, every NEW request is refused `not_sent join_stopped` before any
        # I/O; `busy` counts the requests handed to the session loop from outside it (the drain waits for them before the socket closes).
        self._closing = False
        self._busy = 0
        self._busy_lock = threading.Lock()

    def __repr__(self) -> str:
        return f"DirectCommandSession(connected={self.connected})"

    @property
    def loop(self) -> asyncio.AbstractEventLoop:
        return self.runner._ensure()

    def on_loop(self) -> bool:
        try:
            return asyncio.get_running_loop() is self.loop
        except RuntimeError:
            return False

    @property
    def connected(self) -> bool:
        link = self._link
        return link is not None and not link.closed

    async def link(self) -> bridge.DirectLink:
        """The open link, or a new one (between requests only). Raises MediaBridgeError outcome `not_sent`."""
        if self._lock is None:
            self._lock = asyncio.Lock()
        async with self._lock:
            link = self._link
            if link is not None and not link.closed:
                return link
            if self._clock() < self._down_until:
                raise bridge.MediaBridgeError("wiskey_direct_not_connected", "not_sent")
            try:
                new = await self.transport.connect(bridge.PURPOSE_COMMAND)
            except bridge.MediaBridgeError as exc:
                self.last_error = exc.code
                if exc.code not in ("bridge_not_paired", "bridge_key_rotated"):
                    self._down_until = self._clock() + self.RETRY_DIRECT_S
                raise bridge.MediaBridgeError(exc.code, "not_sent") from None
            if not isinstance(new, bridge.DirectLink):  # the join needs the direct link's generic command (never a media fallback)
                await new.close()
                raise bridge.MediaBridgeError("wiskey_direct_not_connected", "not_sent")
            self._link = new
            self.last_error = None
            return new

    async def call(self, command: str, parameters: Mapping[str, Any], *, timeout: float) -> dict[str, Any]:
        """One request on the session loop. MediaBridgeError with outcome not_sent | refused | unknown (`closed` never escapes)."""
        from . import wiskey_call_budget as budget
        if budget.active():
            timeout = budget.remaining(timeout)
        async with asyncio.timeout(timeout):
            return await self._call_with_budget(command, parameters, timeout=timeout)

    async def _call_with_budget(self, command: str, parameters: Mapping[str, Any], *, timeout: float) -> dict[str, Any]:
        if self._closing:  # WISKEY-JOIN-LIVE-2382: the join is stopping - nothing new is written
            raise bridge.MediaBridgeError(STOPPED_CODE, "not_sent")
        if not isinstance(parameters, Mapping):
            raise bridge.MediaBridgeError("invalid_parameters", "not_sent")
        refusal = catalog.direct_refusal(command)  # HA-body audio commands and the owner-excluded job-approval writes: never written
        if refusal is not None:
            raise bridge.MediaBridgeError(refusal, "not_sent")
        link = await self.link()
        if self.require_discovery and command not in DISCOVERY_COMMANDS:
            await self.discover(link)
            refusal = self.discovery.transport_refusal(link.connection_ref, command)
            if refusal is not None:
                raise bridge.MediaBridgeError(refusal, "not_sent")
        from . import wiskey_call_budget as budget
        timeout = budget.remaining(timeout) if budget.active() else timeout
        try:
            return await link.call_command(command, dict(parameters), kind=envelope_kind(command), timeout=timeout)
        except bridge.MediaBridgeError as exc:
            if exc.outcome in ("not_sent", "refused", "unknown"):
                raise
            raise bridge.MediaBridgeError(exc.code, "unknown") from None
        except asyncio.CancelledError:
            raise bridge.MediaBridgeError("cancelled", "unknown") from None

    async def discover(self, link: bridge.DirectLink | None = None) -> None:
        """Read direct/capabilities + direct/time on `link` (the current connection) when this connection has no document yet or the
        time observation is stale. Session loop only, between requests; never raises (a failure leaves the direct path unselected)."""
        if self._discovery_lock is None:
            self._discovery_lock = asyncio.Lock()
        async with self._discovery_lock:
            if link is None:
                try:
                    link = await self.link()
                except bridge.MediaBridgeError:
                    return
            if link.closed:
                return

            async def read(command: str, parameters: Mapping[str, Any]) -> Any:
                return await link.call_command(command, dict(parameters), kind=bridge.KIND, timeout=DISCOVERY_TIMEOUT_S)

            await self.discovery.refresh(link.connection_ref, read)

    def transport_refusal(self, command: str | None = None) -> str | None:
        """Why the direct path may not carry `command` on the current connection now (None = it may). No I/O."""
        if self._closing:
            return STOPPED_CODE
        link = self._link
        if link is None or link.closed:
            return "wiskey_direct_not_connected"
        if command is not None and catalog.direct_refusal(command) is not None:
            return catalog.direct_refusal(command)
        if not self.require_discovery:
            return None
        return self.discovery.transport_refusal(link.connection_ref, command)

    # -- bridging --------------------------------------------------------------------------------------------------------------------
    async def run_async(self, coro: Awaitable[Any]) -> Any:
        """Await `coro` on the session loop from any loop, without blocking the caller's loop; shielded from the caller's cancel."""
        if self.on_loop():
            return await coro
        self._enter(coro)
        try:
            future = asyncio.run_coroutine_threadsafe(coro, self.loop)  # type: ignore[arg-type]
        except BaseException:
            self._leave()
            _close_coro(coro)
            raise
        future.add_done_callback(lambda _f: self._leave())
        return await asyncio.shield(asyncio.wrap_future(future))

    # -- WISKEY-JOIN-LIVE-2382: the runtime stop ---------------------------------------------------------------------------------------
    def _enter(self, coro: Any) -> None:
        """Count one request handed to the loop from outside; refused `not_sent join_stopped` (nothing scheduled) once closing."""
        with self._busy_lock:
            if self._closing:
                _close_coro(coro)
                raise bridge.MediaBridgeError(STOPPED_CODE, "not_sent")
            self._busy += 1

    def _leave(self) -> None:
        with self._busy_lock:
            self._busy = max(0, self._busy - 1)

    @property
    def busy(self) -> int:
        with self._busy_lock:
            return self._busy

    @property
    def closing(self) -> bool:
        return self._closing

    def begin_close(self) -> None:
        """From now on nothing new is handed to the loop or written (a request already in flight runs to its own end)."""
        with self._busy_lock:
            self._closing = True

    def drain(self, grace_s: float, *, poll_s: float = 0.02) -> bool:
        """Wait (this thread only, never the session loop) until no request handed in from outside is still running, at most `grace_s`.
        True when idle. A request still running after the grace is cancelled by `close()` - its outcome is then `unknown`, never re-sent."""
        deadline = time.monotonic() + max(0.0, grace_s)
        while self.busy > 0:
            if time.monotonic() >= deadline:
                return False
            time.sleep(poll_s)
        return True

    def run_sync(self, coro: Awaitable[Any], timeout: float) -> Any:
        """Block the calling thread (never the session loop) until `coro` ends on the session loop."""
        if self.on_loop():
            close = getattr(coro, "close", None)
            if close is not None:
                close()
            raise bridge.MediaBridgeError("wrong_thread", "not_sent")
        from . import wiskey_call_budget as budget
        try:
            timeout = budget.remaining(timeout) if budget.active() else timeout
        except budget.DeadlineExpired:
            coro.close()
            raise
        self._enter(coro)
        try:
            return self.runner.run(coro, timeout)
        finally:
            self._leave()

    def connect_ready(self, timeout: float = DEFAULT_TIMEOUT_S, command: str | None = None) -> bool:
        """Selection rule part (3): the socket is (or now becomes) authenticated - and, with `require_discovery` (WKR5-295, part (4)),
        this connection's discovery lists `command` (when given) and its time observation admits Arx's signing window. Respects the
        60 s back-off; never raises."""
        if self._closing:
            return False
        if not self.connected:
            if self._clock() < self._down_until:
                return False
            try:
                if self.on_loop():
                    return False
                self.run_sync(self.link(), timeout + RUN_MARGIN_S)
            except Exception:  # noqa: BLE001 - any failure is "not selected"
                return False
            if not self.connected:
                return False
        if self.require_discovery and not self.on_loop() and self.discovery_due():
            try:
                self.run_sync(self.discover(), 2 * DISCOVERY_TIMEOUT_S + RUN_MARGIN_S)
            except Exception:  # noqa: BLE001
                return False
        return self.connected and self.transport_refusal(command) is None

    def discovery_due(self) -> bool:
        """This connection has no discovery yet (and none failed on it), or its time observation is stale (re-read as an observation;
        it renews nothing)."""
        link = self._link
        if link is None or link.closed:
            return False
        d = self.discovery
        if d.failed_ref == link.connection_ref:
            return False
        if d.capabilities is None or d.time is None or d.capabilities.connection_ref != link.connection_ref:
            return True
        return d.stale()

    def identity(self) -> PortIdentity:
        link = self._link
        if link is None or link.closed:
            raise PortError("wiskey_direct_not_connected", "not_sent")
        owner = link.query_owner_id
        return PortIdentity(entry_id=owner[len(bridge.DIRECT_SERVICE_PREFIX):], query_owner_id=owner,
                            repository_id=link.repository_id or "", connection_ref=link.connection_ref)

    def close(self) -> None:
        """Close the socket and end the loop (its remaining tasks are cancelled by `LoopThread.stop`). Idempotent; never raises."""
        self.begin_close()
        link, self._link = self._link, None
        if link is not None:
            try:
                self.runner.run(link.close(), 10)
            except Exception:  # noqa: BLE001
                pass
        try:
            self.runner.stop()
        except Exception:  # noqa: BLE001 - media_cleanup_failed: the loop's own cleanup stays unresolved; the join is gone either way
            log.warning("wiskey direct join: the session loop did not end cleanly")


# ---------------------------------------------------------------- WiskeyCommandPort (WKWRITE)

class DirectCommandPort:
    """`WiskeyCommandPort` over the session. `operation_id` is correlation only (never on the wire here, never authority)."""

    def __init__(self, session: DirectCommandSession, *, timeout_s: float = DEFAULT_TIMEOUT_S) -> None:
        self.session = session
        self.timeout_s = timeout_s

    def __repr__(self) -> str:
        return "DirectCommandPort()"

    async def send_signed(self, command: str, parameters: Mapping[str, Any], *, operation_id: str | None) -> Mapping[str, Any]:  # noqa: ARG002
        try:
            return await self.session.run_async(self.session.call(command, parameters, timeout=self.timeout_s))
        except bridge.MediaBridgeError as exc:
            raise WiskeyCommandError(exc.code, outcome=_outcome(exc)) from None
        except asyncio.CancelledError:
            raise WiskeyCommandError("cancelled", outcome=UNKNOWN) from None
        except Exception as exc:  # noqa: BLE001 - after a possible hand-over: unknown, never a not-sent proof
            raise WiskeyCommandError(type(exc).__name__, outcome=UNKNOWN) from None


def _outcome(exc: bridge.MediaBridgeError) -> str:
    return {"not_sent": NOT_SENT, "refused": REFUSED}.get(exc.outcome, UNKNOWN)


# ---------------------------------------------------------------- WiskeyDirectPort (WKCAP)

class DirectCapturePort:
    """`WiskeyDirectPort` over the session: synchronous, blocks only its calling thread."""

    def __init__(self, session: DirectCommandSession) -> None:
        self.session = session

    def __repr__(self) -> str:
        return "DirectCapturePort()"

    def identity(self) -> PortIdentity:
        return self.session.identity()

    def call(self, command: str, parameters: Mapping[str, Any], *, timeout_s: float) -> Mapping[str, Any]:
        try:
            from . import wiskey_call_budget as budget
            timeout_s = budget.remaining(timeout_s) if budget.active() else timeout_s
            return self.session.run_sync(self.session.call(command, parameters, timeout=timeout_s), timeout_s if budget.active() else timeout_s + RUN_MARGIN_S)
        except bridge.MediaBridgeError as exc:
            raise PortError(exc.code, _outcome(exc)) from None
        except Exception as exc:  # noqa: BLE001
            raise PortError(type(exc).__name__, "unknown") from None

    def media_ingress_header(self, *, ticket: str, preparation_ref: str) -> str:
        """The `X-WisKey-Bridge` value: the ordinary pairing-signed body of `features/media_ingress_v1` with exactly {ticket,
        preparation_ref, connection_ref} - connection_ref the challenge of THIS command connection (DIRECT_FEATURE_MEDIA_V1.md)."""
        link = self.session._link
        if link is None or link.closed:
            raise PortError("wiskey_direct_not_connected", "not_sent")
        if not (isinstance(ticket, str) and ticket and isinstance(preparation_ref, str) and preparation_ref):
            raise PortError("invalid_parameters", "not_sent")
        try:
            body = link.signed_body(MEDIA_INGRESS_COMMAND, {"ticket": ticket, "preparation_ref": preparation_ref,
                                                            "connection_ref": link.connection_ref})
        except bridge.MediaBridgeError as exc:
            raise PortError(exc.code, "not_sent") from None
        return json.dumps(body, separators=(",", ":"), ensure_ascii=False)

    def open_media(self, *, path: str, headers: Mapping[str, str], timeout_s: float) -> Any:
        """Open the anonymous media WebSocket `arx_bridge/v1/media/{ticket}` with the signed header (no token, no query string). The
        returned connection belongs to the session loop (`session.loop`). NOT exercised against a real WisKey."""
        if not isinstance(path, str) or not path.startswith(MEDIA_PATH_PREFIX) or "?" in path or "#" in path or len(path) <= len(MEDIA_PATH_PREFIX):
            raise PortError("invalid_media_path", "not_sent")
        opener = self.session.media_opener
        if opener is None:
            raise PortError("media_not_configured", "not_sent")
        try:
            return self.session.run_sync(opener(path, dict(headers), timeout_s), timeout_s + RUN_MARGIN_S)
        except bridge.MediaBridgeError as exc:
            raise PortError(exc.code, _outcome(exc)) from None
        except Exception as exc:  # noqa: BLE001 - the upgrade may have reached the host: unknown
            raise PortError(type(exc).__name__, "unknown") from None


def websocket_media_opener(settings: Any) -> Callable[[str, Mapping[str, str], float], Awaitable[Any]]:
    async def open_media(path: str, headers: Mapping[str, str], timeout_s: float) -> Any:
        import websockets

        base = await asyncio.to_thread(bridge.direct_ws_url, settings)
        url = base[: -len(bridge.DIRECT_PATH)] + path if base.endswith(bridge.DIRECT_PATH) else base
        kw: dict[str, Any] = {"open_timeout": timeout_s, "close_timeout": 2, "additional_headers": dict(headers)}
        if url.startswith("wss://"):
            import ssl

            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            kw["ssl"] = ctx
        return await websockets.connect(url, **kw)

    return open_media


class SelectedFeaturePort:
    """Same Join predicate at the original feature adapter boundary, every call.

    This is a port wrapper, not another engine/authority/dispatcher. Selection
    may connect/discover through the same bounded session before identity is
    read. A disabled provider is never bypassed by the installed factory.
    """
    def __init__(self, join):
        self.join = join

    def identity(self):
        if not self.join.selected("features/start"):
            raise PortError("transport_not_selected", "not_sent")
        return self.join.capture_port.identity()

    def call(self, command, parameters, *, timeout_s):
        if not self.join.selected(command):
            raise PortError("transport_not_selected", "not_sent")
        return self.join.capture_port.call(command, parameters, timeout_s=timeout_s)


# ---------------------------------------------------------------- the selection wrappers (existing path otherwise)

def mapped_card_transport(join: "DirectJoin", direct: Any) -> Any:
    """WISKEY-OWNER26-297 (W-005, owner26 Q2 "card"): the original card-capture caller (capture routes and the lease worker ->
    `lease_events.TRANSPORT`) reaches WisKey's Native `capture/lease_event | lease_request` on the direct path only through the CAPMAP DTO9
    pre-flight (`wiskey_capture_map.MappedLeaseTransport`) whenever the mapping is enabled. The announced command list is what THIS
    connection's discovery lists now (`selected(command)`). While `MAPPING_ENABLED` is False (this build) the direct path is the plain
    `DirectLeaseTransport`, byte for byte the call it made before; `capture_lease.GO_LIVE_PERMITTED` stays False either way."""
    from . import wiskey_capture_map as cm

    def announced() -> frozenset[str]:
        return frozenset(c for c in (cm.EVENT_COMMAND, cm.REQUEST_COMMAND) if join.selected(c))

    return MappedWhenEnabled(direct, cm.MappedLeaseTransport(direct, announced), cm.enabled)


class MappedWhenEnabled:
    """`lease_events.LeaseTransport`: the CAPMAP pre-flight transport while `enabled()` (read per call), else the plain direct one."""

    def __init__(self, plain: Any, mapped: Any, enabled: Callable[[], bool]) -> None:
        self.plain, self.mapped, self.enabled = plain, mapped, enabled

    def _pick(self) -> Any:
        return self.mapped if self.enabled() else self.plain

    def event(self, settings: Any, text: str) -> Any:
        return self._pick().event(settings, text)

    def request(self, settings: Any, action: str, text: str) -> Any:
        return self._pick().request(settings, action, text)


class SelectingLeaseTransport:
    """`lease_events.LeaseTransport`: the direct `DirectLeaseTransport` while the join selects the direct path, else the existing
    transport (`BridgeLeaseTransport`) - byte for byte the call it made before."""

    def __init__(self, join: "DirectJoin", direct: Any, fallback: Any) -> None:
        self.join, self.direct, self.fallback = join, direct, fallback

    def _pick(self, command: str) -> Any:
        return self.direct if self.join.selected(command) else self.fallback

    def event(self, settings: Any, text: str) -> Any:
        from .wiskey_capture_direct import EVENT_COMMAND

        return self._pick(EVENT_COMMAND).event(settings, text)

    def request(self, settings: Any, action: str, text: str) -> Any:
        from .wiskey_capture_direct import REQUEST_COMMAND

        return self._pick(REQUEST_COMMAND).request(settings, action, text)


class DirectJoin:
    """What `startup` installs (only when (1) and (2) of the rule hold): the session, both ports, the lineage and the writer factory."""

    PROVIDER_TTL_S = 30.0

    def __init__(self, session: DirectCommandSession, *, provider_ok: Callable[[], bool], key_ok: Callable[[], bool],
                 lineage: Any = None, audit_for: Callable[[Any, Any], Any] | None = None, require_discovery: bool = True) -> None:
        self.session = session
        session.require_discovery = require_discovery  # WKR5-295: the join writes only commands this connection's discovery lists
        self.command_port = DirectCommandPort(session)
        self.capture_port = DirectCapturePort(session)
        self._provider_ok = provider_ok
        self._key_ok = key_ok
        self.lineage = lineage
        self.audit_for = audit_for
        self._recovered: set[str] = set()
        self._recover_lock = threading.Lock()
        self.lease_transport: Any = None
        self.template_transport: Any = None
        # WK4ADOPT-295 (W-010): the dedicated live peer reads over this session's verified connection (peer_bindings/get and
        # peer_receipts/resolve, wiskey-peer-query.v1). Built here, used only by their seam clients (go-live switch + owner pin).
        self.registry_transport: Any = None
        self.resolve_transport: Any = None

    def __repr__(self) -> str:
        return f"DirectJoin(session={self.session!r})"

    def selected(self, command: str | None = None) -> bool:
        """The selection rule, evaluated now: (1) auto, (2) the key signs, (3) the socket authenticates, (4) WKR5-295: this connection's
        direct/capabilities lists `command` (when given) and direct/time admits Arx's signing window. Never raises."""
        try:
            if not self._provider_ok() or not self._key_ok():
                return False
        except Exception:  # noqa: BLE001
            return False
        return self.session.connect_ready(command=command)

    def configured(self) -> bool:
        """DOORLIVE-2310: the CONFIG half of the selection rule only - (1) the provider is `auto` and (2) the key signs. No socket, no discovery,
        no I/O beyond the cached readers; never raises. Readiness screens and switch gates use it (a dropped socket must not disable an
        emergency control); every SEND still needs `selected(command)`."""
        try:
            return bool(self._provider_ok() and self._key_ok())
        except Exception:  # noqa: BLE001
            return False

    def template_or_none(self) -> Any:
        from .wiskey_template_direct import V1_COMMAND

        return self.template_transport if self.selected(V1_COMMAND) else None

    def template_v2_or_none(self) -> Any:
        """WKR5-295 unit D: the transport of the v2 (autofill) template send, only while `whatsapp/template_send_v2` is selected."""
        from .wiskey_template_direct import V2_COMMAND

        return self.template_transport if self.selected(V2_COMMAND) else None

    # -- ADOPTR6-295 (W-010): the ONE selection point of the two WK4ADOPT live peer reads (no scheduler, no switch of their own) ----------
    def registry_or_none(self) -> Any:
        """The dedicated `peer_bindings/get` transport, only while this connection selects that command now; else None (nothing sent)."""
        from .wiskey_peer_registry import LiveRegistryTransport

        return self.registry_transport if self.selected(LiveRegistryTransport.COMMAND) else None

    def resolve_or_none(self) -> Any:
        """The dedicated `peer_receipts/resolve` transport, only while this connection selects that command now; else None (nothing sent).
        No Arx route or job calls it in this build: the recovery caller of an UNKNOWN intent is not built (no new scheduler here)."""
        from .wiskey_intents import LiveResolveTransport

        return self.resolve_transport if self.selected(LiveResolveTransport.COMMAND) else None

    # -- WKR5-295 unit B: the six features and the emergency v2 engine, BUILT on the capture port (registered, not installed) ---------
    def features_or_none(self) -> Any:
        """The `FeatureAdapters` of the six features over this join's direct port, only while `features/start` is selected. No Arx
        route calls it yet (each feature's own switch / permit decides that separately)."""
        if not self.selected("features/start"):
            return None
        if self._features is None:
            from .wiskey_feature_direct import DirectFeatureClient, FeatureAdapters

            self._features = FeatureAdapters(DirectFeatureClient(self.capture_port), self.capture_port)
        return self._features

    _features: Any = None
    origin: str | None = None  # WISKEY-JOIN-LIVE-2382: `startup` when installed by `startup` (the runtime manager owns only those)

    def people_csv_or_none(self) -> Any:
        """WKR5ADOPT-295 (W-006): the `FeatureAdapters` for the people CSV preview + start, only while BOTH `features/people_csv_preview`
        and `features/start` are selected on the current connection (direct/capabilities lists them). None otherwise; never raises."""
        from .wiskey_people_csv import COMMAND as preview_command

        if not self.selected(preview_command) or not self.selected("features/start"):
            return None
        return self.features_or_none()

    def emergency_engine(self, connect: Callable[[], Any]) -> Any:
        """The existing `DirectEmergencyEngine` over this Join's selected feature port. Source startup installs this factory;
        business/live permissions remain separate and unchanged. No effect is sent by construction."""
        from .wiskey_emergency_direct import DirectEmergencyEngine
        from .wiskey_feature_direct import DirectFeatureClient, FeatureAdapters

        port = SelectedFeaturePort(self)
        adapters = FeatureAdapters(DirectFeatureClient(port), port)
        return DirectEmergencyEngine(adapters, connect)

    # -- people writes (NativePeopleWriter) ------------------------------------------------------------------------------------------
    async def _ensure_recovered(self, writer: Any) -> None:
        """One `recover(scope)` per process before its first native write (the scope needs the source read). Recovery never sends: it
        only settles this scope's crash leftovers (`intent` -> not_sent, `sending` -> unknown)."""
        with self._recover_lock:
            if self._recovered:
                return
        source = await writer.observe_source()
        scope = source.scope
        with self._recover_lock:
            if scope in self._recovered:
                return
        counts = writer.recover(scope)
        with self._recover_lock:
            self._recovered.add(scope)
        log.info("wiskey people write: lineage recovered (not_sent=%s unknown=%s)", counts.get("not_sent"), counts.get("unknown"))

    def recover_now(self, timeout: float = 30.0) -> dict[str, int] | None:
        """Startup: when the socket authenticates, read the source and recover its scope. Never raises; None when not possible now."""
        if self.lineage is None or not self.selected():
            return None
        from .wiskey_native_write import NativePeopleWriter

        writer = NativePeopleWriter(self.command_port, self.lineage)

        async def go() -> dict[str, int]:
            source = await writer.observe_source()
            counts = writer.recover(source.scope)
            with self._recover_lock:
                self._recovered.add(source.scope)
            return counts

        try:
            return self.session.run_sync(go(), timeout)
        except Exception as exc:  # noqa: BLE001 - recovery is retried before the first write of the scope
            log.info("wiskey people write: startup recovery deferred (%s)", type(exc).__name__)
            return None

    async def native_write(self, command: str, business: Mapping[str, Any], *, actor: Any, decision: Any,
                           create_origin_ref: str | None, audit_sink: Any = None) -> tuple[Any, Any]:
        """Run ONE native people write on the session loop. Returns (WriteOutcome, the ACK's inner `result` when committed)."""
        from .wiskey_native_write import NativePeopleWriter

        recorder = _RecordingPort(self.command_port, command)

        async def go() -> tuple[Any, Any]:
            writer = NativePeopleWriter(recorder, self.lineage, audit_sink=audit_sink)
            await self._ensure_recovered(writer)
            outcome = await writer.write(command, business, actor=actor, decision=decision, create_origin_ref=create_origin_ref)
            return outcome, recorder.take()

        return await self.session.run_async(go())

    # -- WKR5-295 unit C / F: the lineage's administration and the original receipt readers ---------------------------------------
    def lineage_view(self) -> dict[str, Any]:
        """What an administrator may see: status, counts per state, the OPEN operations (refs, command, state, code, times). Never the
        sealed original, a name, a PIN or a card."""
        lin = self.lineage
        if lin is None:
            return {"installed": True, "lineage": None}
        counts: dict[str, int] = {}
        for state, n in lin.db.execute("SELECT state, COUNT(*) FROM intents GROUP BY state").fetchall():
            counts[state] = n
        open_ops = [{"operation_id": i.operation_id, "kind": i.kind, "command": i.command, "state": i.state, "code": i.outcome_code,
                     "target_ref": i.target_ref, "created_at": i.created_at, "send_started_at": i.send_started_at}
                    for i in lin.open_intents()]
        return {"installed": True, "lineage": {"status": lin.status, "writable": lin.writable(), "counts": counts, "open": open_ops},
                "discovery": self.session.discovery.snapshot()}

    async def resolve(self, operation_id: str) -> Any:
        """The ORIGINAL reader of one UNKNOWN operation, chosen by its kind: a peer write -> `peer_receipts/resolve` with a CURRENT read
        binding and the stored full original7 (never rebuilt from refs or the current state); a name_ref apply -> `users/bulk_receipt`
        by the same pairing-service actor. A read only: the mutation is never sent again. Runs on the session loop."""
        from .wiskey_native_write import NativePeopleWriter

        lin = self.lineage
        if lin is None:
            from .wiskey_native_write import NativeWriteError

            raise NativeWriteError("lineage_unavailable")
        intent = lin.get(operation_id)

        async def go() -> Any:
            writer = NativePeopleWriter(self.command_port, lin)
            return await (writer.resolve_name_ref(operation_id) if intent.kind == "name_ref" else writer.resolve(operation_id))

        return await self.session.run_async(go())

    def close_unknown(self, operation_id: str, *, actor_ref: str, code: str) -> None:
        if self.lineage is None:
            raise ValueError("lineage_unavailable")
        self.lineage.close_unknown(operation_id, actor_ref=actor_ref, code=code)

    def reinitialise(self, *, actor_ref: str) -> None:
        if self.lineage is None:
            raise ValueError("lineage_unavailable")
        self.lineage.reinitialise(actor_ref=actor_ref)

    PURGE_EVERY_S = 3600.0
    _purged_at = -1e18

    def purge_due(self, now: float | None = None) -> int | None:
        """The 30-day retention of ENDED operations (open unknowns are never purged), at most once an hour. None when not run now."""
        if self.lineage is None:
            return None
        t = time.monotonic() if now is None else now
        if t - self._purged_at < self.PURGE_EVERY_S:
            return None
        self._purged_at = t
        return self.lineage.purge()

    def close(self, drain_s: float = 0.0) -> bool:
        """WISKEY-JOIN-LIVE-2382: the clean stop. (1) nothing new starts (`not_sent join_stopped`); (2) the requests already in flight get
        `drain_s` to end on their own; (3) the socket closes and the loop ends - a request still running is cancelled and settles `unknown`
        in the still-open lineage (never re-sent); (4) the lineage closes last (its writer lease is handed over at once). Returns whether
        the drain ended idle."""
        self.session.begin_close()
        idle = self.session.drain(drain_s) if drain_s > 0 else self.session.busy == 0
        self.session.close()
        if self.lineage is not None:
            try:
                self.lineage.close()
            except Exception:  # noqa: BLE001
                pass
        return idle


class _RecordingPort:
    """A per-write view of the command port that keeps the inner `result` of the ACK of ONE mutation (for the route's projection,
    which the writer does not return). Nothing else is kept; it is dropped with the write."""

    def __init__(self, port: DirectCommandPort, command: str) -> None:
        self._port, self._command, self._result = port, command, None

    async def send_signed(self, command: str, parameters: Mapping[str, Any], *, operation_id: str | None) -> Mapping[str, Any]:
        result = await self._port.send_signed(command, parameters, operation_id=operation_id)
        if command == self._command and isinstance(result, Mapping):
            self._result = result.get("result")
        return result

    def take(self) -> Any:
        out, self._result = self._result, None
        return out


# ---------------------------------------------------------------- process state

JOIN: DirectJoin | None = None
# WISKEY-JOIN-LIVE-2382: `startup` and `shutdown` run one at a time (the runtime manager, the add-on start/stop and the automatic
# installation's reconcile may all call them); a second `startup` while a join is installed returns that join (never a second one).
LIFECYCLE = threading.RLock()
ORIGIN_STARTUP = "startup"


def installed() -> DirectJoin | None:
    return JOIN


def janitor() -> int | None:
    """WKR5-295 unit C: the hourly lineage retention step of the main janitor (nothing when the join is not installed)."""
    join = JOIN
    if join is None:
        return None
    return join.purge_due()


# WISKEY-JOIN-LIVE-2382: when the direct path was chosen for a people write but did not carry it, the write may go over the classic
# (Home Assistant) channel instead - ONLY when Arx holds proof that the direct attempt had no effect AND that the classic write cannot
# duplicate an earlier native one:
#   - the native outcome `not_sent` (no byte of the mutation frame was written - the WKWRITE contract), whatever its code;
#   - a refusal of the native writer BEFORE its intent for a transport / availability reason (the codes and prefixes below): the source
#     read failed or WisKey's source does not offer the action, the lineage is closed / missing / stale, another holder has the scope;
#   - a VERIFIED WisKey refusal that is pre-effect AND says the direct channel cannot carry this write (not a business answer).
# Never: an `unknown` outcome (timeout after the write, a lost answer, a refused signature - WisKey's `Unauthorized` may follow a commit,
# so the writer settles it unknown), a business refusal (invalid_fields, revision_conflict, user_not_found, ...), an Arx authority or
# actor refusal (rbac_denied, actor_session_inactive, ...), or a lineage answer that names an earlier native write of this person or
# origin (create_origin_already_used, person_write_in_flight, duplicate_operation). Those fail visibly with their code. The classic
# write is a NEW request on its own channel (its own frame, no native nonce reused); the native frame is never sent again.
FALLBACK_NATIVE_ERRORS = frozenset({"action_not_offered", "lineage_unavailable", "lineage_closed", "lineage_missing", "lineage_stale",
                                    "writer_busy", "writer_fenced", STOPPED_CODE})
FALLBACK_NATIVE_PREFIXES = ("source_unavailable:", "source_invalid:")
FALLBACK_REFUSALS = frozenset({"native_write_source_not_observed", "native_write_action_unsupported", "unknown_command"})
NO_FALLBACK = frozenset({"create_origin_already_used", "person_write_in_flight", "duplicate_operation"})
PATH_DIRECT = "wiskey_direct"
PATH_CLASSIC = "classic"
PATH_CLASSIC_AFTER_DIRECT = "classic_after_direct"


def fallback_permitted(state: str, code: str | None) -> bool:
    """Whether a people write the direct path did not carry may go over the classic channel (see the rule above). Pure."""
    c = code or ""
    if c in NO_FALLBACK:
        return False
    if state == "not_sent":
        return True
    if state == "native_error":
        return c in FALLBACK_NATIVE_ERRORS or c.startswith(FALLBACK_NATIVE_PREFIXES)
    if state == "refused":
        return c in FALLBACK_REFUSALS
    return False  # unknown, committed, anything else


def people_send(conn: Any, principal: Any, command: str, business: Mapping[str, Any], *, targets: list[tuple[str, str]],
                create_origin_ref: str | None = None, fallback: Callable[[Any], Awaitable[Any]] | None = None,
                not_after: Any = None, record: Callable[..., None] | None = None) -> Callable[[Any], Awaitable[Any]] | None:
    """For the people-write routes: the `send(call)` coroutine function of a NATIVE write when the direct path is selected now, else
    None (the route keeps its own Home Assistant send, unchanged). The returned send ignores the feed's `call` and maps the native
    outcome onto what intercom_sync already understands: committed -> the ACK's result (projected as before), not_sent ->
    `intercom_sync.NotSent`, a pre-effect refusal -> `IntercomError(code)`, unknown -> `UnclearAnswer(code)` (never re-sent).

    WISKEY-JOIN-LIVE-2382: with `fallback` (the route's Home Assistant send) a write the direct path provably did not carry goes over the
    classic channel once (`fallback_permitted`), unless `not_after` (the route's expiry) has passed - then `NotSent("expired")`.
    `record(**fields)` receives the path actually used (`transport`, and on a fallback `direct_state` / `direct_code`) for the route's
    audit row."""
    join = JOIN
    if join is None or join.lineage is None or not join.selected(command):
        return None
    from . import intercom_client, intercom_sync
    from . import intercom_writes as iw
    from .trusted_door import actor_name
    from .wiskey_native_write import NativeWriteError, WriteActor, arx_decision

    refusal: str | None = None
    actor = decision = None
    try:
        actor = WriteActor(principal.user_id, actor_name(principal), session_active=iw.interactive(principal))
        actor.check()
        decision = arx_decision(conn, principal, "access.people.manage", targets)
    except NativeWriteError as exc:
        refusal = exc.code
    audit_sink = join.audit_for(conn, principal) if join.audit_for is not None else None
    used: dict[str, bool] = {"classic": False}

    def note(**fields: Any) -> None:
        if record is not None:
            try:
                record(**fields)
            except Exception:  # noqa: BLE001 - the record is the audit's; it never changes the write
                log.warning("wiskey people write: the path could not be recorded")

    async def classic(call: Any, state: str, code: str | None) -> Any:
        """The ONE classic attempt after a direct attempt that provably had no effect."""
        import datetime as _dt

        if used["classic"]:  # defensive: the feed calls a send once; a second classic write is never made here
            raise intercom_sync.NotSent("classic_already_used")
        used["classic"] = True
        note(transport=PATH_CLASSIC_AFTER_DIRECT, direct_state=state, direct_code=code)
        if not_after is not None and _dt.datetime.now(_dt.timezone.utc) >= not_after:
            raise intercom_sync.NotSent("expired")
        log.info("wiskey people write: the direct path did not carry %s (%s %s); sent over the classic channel", command, state, code)
        return await fallback(call)  # type: ignore[misc]

    async def send(call: Any) -> Any:
        if refusal is not None:
            note(transport=PATH_DIRECT, direct_state="native_error", direct_code=refusal)
            raise intercom_sync.NotSent(refusal)
        try:
            outcome, raw = await join.native_write(command, business, actor=actor, decision=decision, create_origin_ref=create_origin_ref,
                                                   audit_sink=audit_sink)
        except NativeWriteError as exc:  # refused before any intent / I/O of the mutation
            if fallback is not None and fallback_permitted("native_error", exc.code):
                return await classic(call, "native_error", exc.code)
            note(transport=PATH_DIRECT, direct_state="native_error", direct_code=exc.code)
            raise intercom_sync.NotSent(exc.code) from None
        except bridge.MediaBridgeError as exc:  # the session refused to take the write (the join stopping): nothing was handed over
            if exc.outcome != "not_sent":
                note(transport=PATH_DIRECT, direct_state="unknown", direct_code=exc.code)
                raise intercom_client.UnclearAnswer(command, exc.code) from None
            if fallback is not None and fallback_permitted("not_sent", exc.code):
                return await classic(call, "not_sent", exc.code)
            note(transport=PATH_DIRECT, direct_state="not_sent", direct_code=exc.code)
            raise intercom_sync.NotSent(exc.code) from None
        if outcome.state == "committed":
            note(transport=PATH_DIRECT, direct_state="committed", direct_code=None)
            if command == "users/delete":
                return {"accepted": True}
            return raw
        if fallback is not None and fallback_permitted(outcome.state, outcome.code):
            return await classic(call, outcome.state, outcome.code)
        note(transport=PATH_DIRECT, direct_state=outcome.state, direct_code=outcome.code)
        if outcome.state == "not_sent":
            raise intercom_sync.NotSent(outcome.code or "not_sent")
        if outcome.state == "refused":
            raise intercom_client.IntercomError(outcome.code or "refused", command)
        raise intercom_client.UnclearAnswer(command, outcome.code or "unknown")

    return send


def people_path(command: str = "users/update") -> dict[str, Any]:
    """WISKEY-JOIN-LIVE-2382: which channel a people write would take NOW and why - no I/O, never raises. `path`: `direct` | `classic`;
    `reason`: None for direct, else a closed code (`not_installed`, `lineage_unavailable`, `lineage_<status>`, `not_configured`, or the
    session's transport refusal: `wiskey_direct_not_connected`, `join_stopped`, a discovery code). A selected direct write that WisKey
    then does not carry may still go classic per write (`fallback_permitted`)."""
    join = JOIN
    try:
        if join is None:
            return {"path": "classic", "reason": "not_installed"}
        lin = join.lineage
        if lin is None:
            return {"path": "classic", "reason": "lineage_unavailable"}
        if not lin.writable():
            return {"path": "classic", "reason": f"lineage_{lin.status}" if lin.status in ("missing", "stale", "closed") else "lineage_unavailable"}
        if not join.configured():
            return {"path": "classic", "reason": "not_configured"}
        refusal = join.session.transport_refusal(command)
        if refusal is not None:
            return {"path": "classic", "reason": refusal}
        return {"path": "direct", "reason": None}
    except Exception:  # noqa: BLE001
        return {"path": "classic", "reason": "unreadable"}


def _cached(fn: Callable[[], Any], ttl: float) -> Callable[[], Any]:
    state: dict[str, Any] = {"at": -1e18, "value": None}

    def read() -> Any:
        now = time.monotonic()
        if now - state["at"] >= ttl:
            state["value"] = fn()
            state["at"] = now
        return state["value"]

    return read


def startup(db: Any, settings: Any, *, opener: Callable[[], Awaitable[Any]] | None = None, open_lineage: bool = True,
            provider_reader: Callable[[], bool] | None = None, key_reader: Callable[[], Any] | None = None) -> DirectJoin | None:
    """Install the join when (1) `auto` and (2) the key signs hold NOW; else install nothing and return None. Opens ONE lineage for
    this process and tries `recover(scope)` once (deferred to the first write of the scope when the socket is not up)."""
    with LIFECYCLE:
        if JOIN is not None:  # WISKEY-JOIN-LIVE-2382: never a second join (the installed one stays; nothing is opened twice)
            return JOIN
        return _startup(db, settings, opener=opener, open_lineage=open_lineage, provider_reader=provider_reader, key_reader=key_reader)


def _startup(db: Any, settings: Any, *, opener: Callable[[], Awaitable[Any]] | None, open_lineage: bool,
             provider_reader: Callable[[], bool] | None, key_reader: Callable[[], Any] | None) -> DirectJoin | None:
    global JOIN
    from . import ha_bridge, lease_events
    from . import wa_template_send as wts
    from . import wiskey_capture_direct, wiskey_template_direct
    from .intercom_media import PROVIDER_KEY, provider_choice

    def read_provider() -> bool:
        with db.connection(mode="read", label="wiskey join provider") as c:
            return provider_choice(c) == "auto"

    def read_key() -> Any:
        with db.connection(mode="read", label="wiskey join key") as c:
            return ha_bridge.signing_key(c)

    def key_signs(key: Any) -> bool:
        try:
            bridge._key_text(key)
        except bridge.MediaBridgeError:
            return False
        return True

    read_provider = provider_reader or read_provider  # tests inject both readers (the rule is the same)
    read_key = key_reader or read_key
    try:
        if not read_provider() or not key_signs(read_key()):
            return None
    except Exception:  # noqa: BLE001 - an unreadable state installs nothing
        return None
    key_provider = _cached(read_key, 30.0)
    transport = bridge.DirectApiTransport(opener or bridge.websocket_opener(settings), key_provider)
    session = DirectCommandSession(transport, media_opener=websocket_media_opener(settings))
    lineage = None
    if open_lineage:
        from .wiskey_write_lineage import SettingsAnchor
        from .wiskey_write_lineage import open_lineage as _open

        lineage = _open(settings.data_dir, SettingsAnchor(settings.db_path))
    from .wiskey_native_write import audit_to

    join = DirectJoin(session, provider_ok=_cached(read_provider, DirectJoin.PROVIDER_TTL_S),
                      key_ok=lambda: key_signs(key_provider()), lineage=lineage, audit_for=audit_to)
    join.origin = ORIGIN_STARTUP  # WISKEY-JOIN-LIVE-2382: the runtime manager stops only a join `startup` installed
    join.lease_transport = SelectingLeaseTransport(join, mapped_card_transport(join, wiskey_capture_direct.DirectLeaseTransport(join.capture_port)),
                                                   lease_events.BridgeLeaseTransport())
    join.template_transport = wiskey_template_direct.DirectTemplateTransport(join.capture_port)
    from .wiskey_intents import LiveResolveTransport
    from .wiskey_peer_registry import LiveRegistryTransport

    join.registry_transport = LiveRegistryTransport(join.capture_port)
    join.resolve_transport = LiveResolveTransport(join.capture_port)
    lease_events.set_transport(join.lease_transport)
    wts.TRANSPORT_PROVIDER = join.template_or_none
    wts.TRANSPORT_V2_PROVIDER = join.template_v2_or_none
    from . import wiskey_auto_install

    # WISKEY-ADOPT-2272 review M2: the job-approval writes stay excluded unless the automatic installation switch is on (read live)
    catalog.INSTALLATION_SWITCH = lambda: wiskey_auto_install.switch_on_db(db)
    JOIN = join
    # WISKEY-RC4-2310: the owner30 contribution installed `join.emergency_engine(...)` as the process's emergency engine here. Superseded by
    # DOORLIVE-2310: `door_engine_live.startup` (called right after this) installs `LiveEmergencyEngine`, which resolves the CURRENT join on every
    # call, re-checks `selected("features/start")` and delegates to the same `emergency_engine()` (now over the rc.4 SelectedFeaturePort).
    log.info("wiskey direct join installed (%s = auto, key signs); the direct path is used while its socket authenticates", PROVIDER_KEY)
    return join


def shutdown(drain_s: float = 0.0) -> bool | None:
    """Uninstall everything `startup` installed (the existing transports come back), then stop the join cleanly (`DirectJoin.close`):
    the globals go first, so no new caller can pick the join while it drains. None when nothing was installed, else whether the drain
    ended idle."""
    global JOIN
    from . import lease_events
    from . import wa_template_send as wts

    with LIFECYCLE:
        join, JOIN = JOIN, None
        catalog.INSTALLATION_SWITCH = None  # review M2: back to the exclusion
        if join is None:
            return None
        if lease_events.TRANSPORT is join.lease_transport:
            lease_events.set_transport(None)
        if wts.TRANSPORT_PROVIDER == join.template_or_none:
            wts.TRANSPORT_PROVIDER = None
        if wts.TRANSPORT_V2_PROVIDER == join.template_v2_or_none:
            wts.TRANSPORT_V2_PROVIDER = None
        return join.close(drain_s=drain_s)
