"""WKR5-295 (hand-off unit A / Q-request 8): Arx's reader of WisKey's direct discovery - `direct/capabilities` and `direct/time`
(DIRECT_DISCOVERY_V1.md, WisKey `direct_bridge_discovery.py`, CODE fa05c60b) - and how it feeds the transport choice of the join.

Both are ordinary signed reads on the AUTHENTICATED direct command connection: the existing `wiskey-bridge-command.v1` envelope,
`parameters = {}` exactly (WisKey refuses anything else), the reply MAC + connection_ref verified by the link before anything here
reads it. Nothing new is signed, no `api_contract`, no `kid`.

What Arx takes from them (and what it does NOT):
- `direct/capabilities` is bound to the connection it was read on (its connection_ref). A reconnect is a new owner: the old document
  is dropped and discovery runs again; nothing of an old connection (talk, job, carrier, cursor) is adopted.
- The command names are the CURRENT direct routes for this service subject. The join sends a command on the direct path only when
  it is listed here; a command missing from the list keeps the existing (Home Assistant) path, it is not "refused".
- `commands[].envelope` is the transport protocol (`wiskey-direct-ws.v1`) and is checked to be exactly that; it is never used as a
  `bridge.kind` (W5-API-01). The kind comes from the catalog row (wiskey_direct_catalog.envelope_for).
- `lifecycle`: v1 has no kid, no durable event cursor, and a reconnect never adopts old resources. If WisKey ever reports otherwise,
  this v1 client does not select the direct path (`lifecycle_unsupported`) instead of guessing a new contract.
- `limits` and `resources` are recorded as observations (connection / audio / nonce limits, feature host state, template binding).
  They are not installation or physical facts and change no Arx setting.
- `direct/time` is an OBSERVATION of WisKey's verifier clock. Arx uses it only to decide whether its own signed requests can be
  admitted: the measured skew plus a margin must fit `max_issued_future_seconds` (Arx ahead) or Arx's own signing window (WisKey
  ahead), never beyond `max_ts_skew_seconds`, and Arx's signing window must not exceed `max_command_ttl_seconds`. It never extends a request, a lease, a source's currentness or an execution permission, and Arx never
  shifts its signing clock to the server's.
Status: implemented and tested against the in-memory fake direct server only (tests/test_wkr5_295.py)."""
from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Mapping

from . import wiskey_media_bridge as bridge

CAPABILITIES = "direct/capabilities"
TIME = "direct/time"
SCHEMA_VERSION = 1
# WisKey admits a signed request while |ts - now| <= max_ts_skew, issued_at <= now + max_issued_future and now < expires_at
# (issued_at + Arx's window). Arx signs with its OWN clock, so it keeps these margins in hand on each side:
BEHIND_MARGIN_S = 2.0  # server ahead of Arx: skew + margin must stay below Arx's window (else a request expires on arrival)
AHEAD_MARGIN_S = 0.5  # Arx ahead of the server: skew + margin must stay within max_issued_future
TIME_RECHECK_S = 600.0  # a time observation older than this is read again (the observation never renews anything)
READ_TIMEOUT_S = 6.0
_CAP_KEYS = {"schema_version", "protocol", "families", "commands", "limits", "station_media_contract", "stations", "resources",
             "lifecycle", "physical_result"}
_CMD_KEYS = {"name", "envelope", "api_contract", "explicit_parameter_version"}
_TIME_KEYS = {"schema_version", "server_utc", "max_ts_skew_seconds", "max_issued_future_seconds", "max_command_ttl_seconds"}
_LIFECYCLE_V1 = {"kid_in_v1": False, "event_cursor_resume": False, "reconnect_adopts_old_resources": False}
_NAME_RE = re.compile(r"^[a-z0-9_]+(?:/[a-z0-9_]+)*$")  # `overview` and `subscribe` are single-segment names


class DiscoveryError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _int(v: Any) -> bool:
    return type(v) is int


@dataclass(frozen=True)
class Capabilities:
    connection_ref: str
    commands: frozenset[str]
    families: tuple[str, ...]
    parameter_versions: Mapping[str, int | None] = field(repr=False)
    limits: Mapping[str, Any] = field(repr=False)
    resources: Mapping[str, Any] = field(repr=False)
    stations: int = 0

    def lists(self, command: str) -> bool:
        return command in self.commands


@dataclass(frozen=True)
class TimeObservation:
    connection_ref: str
    skew_s: float  # server - local (wall clocks), measured at the middle of the round trip
    max_ts_skew_s: int
    max_issued_future_s: int
    max_command_ttl_s: int
    observed_at: float  # local monotonic

    def admits(self, window_s: int) -> str | None:
        """None when Arx's signed requests fit WisKey's admission rules, else the reason they would not."""
        if window_s > self.max_command_ttl_s:
            return "ttl_exceeds_server_max"
        behind = self.skew_s  # > 0: the server is ahead of Arx, so Arx's expires_at comes closer to the server's now
        if behind > 0 and (behind + BEHIND_MARGIN_S >= window_s or behind > self.max_ts_skew_s):
            return "clock_skew"
        ahead = -self.skew_s  # > 0: Arx is ahead, so its issued_at lies in the server's future
        if ahead > 0 and (ahead + AHEAD_MARGIN_S > self.max_issued_future_s or ahead > self.max_ts_skew_s):
            return "clock_skew"
        return None


def read_capabilities(raw: Any, connection_ref: str) -> Capabilities:
    """The closed schema_version-1 document, or DiscoveryError. Every command entry's `envelope` must be the transport protocol."""
    if not isinstance(raw, Mapping) or set(raw) != _CAP_KEYS:
        raise DiscoveryError("capabilities_invalid")
    if not _int(raw["schema_version"]) or raw["schema_version"] != SCHEMA_VERSION or raw["protocol"] != bridge.DIRECT_PROTOCOL:
        raise DiscoveryError("capabilities_unsupported")
    commands = raw["commands"]
    if not isinstance(commands, list):
        raise DiscoveryError("capabilities_invalid")
    names: list[str] = []
    versions: dict[str, int | None] = {}
    for c in commands:
        if not isinstance(c, Mapping) or set(c) != _CMD_KEYS or not isinstance(c["name"], str) or not _NAME_RE.fullmatch(c["name"]):
            raise DiscoveryError("capabilities_invalid")
        if c["envelope"] != bridge.DIRECT_PROTOCOL:  # W5-API-01: a transport protocol, never a bridge.kind
            raise DiscoveryError("capabilities_invalid")
        v = c["explicit_parameter_version"]
        if not (v is None or (_int(v) and v >= 1)) or not (c["api_contract"] is None or _int(c["api_contract"])):
            raise DiscoveryError("capabilities_invalid")
        names.append(c["name"])
        versions[c["name"]] = v
    if len(set(names)) != len(names):
        raise DiscoveryError("capabilities_invalid")
    families = raw["families"]
    if not isinstance(families, list) or families != sorted({n.split("/")[0] for n in names}):
        raise DiscoveryError("capabilities_invalid")
    lifecycle = raw["lifecycle"]
    if not isinstance(lifecycle, Mapping) or any(lifecycle.get(k) is not v for k, v in _LIFECYCLE_V1.items()):
        raise DiscoveryError("lifecycle_unsupported")
    limits, resources, stations = raw["limits"], raw["resources"], raw["stations"]
    if not isinstance(limits, Mapping) or not isinstance(resources, Mapping) or not isinstance(stations, list):
        raise DiscoveryError("capabilities_invalid")
    if raw["physical_result"] != "unproven":  # discovery never claims a physical fact
        raise DiscoveryError("capabilities_invalid")
    return Capabilities(connection_ref, frozenset(names), tuple(families), versions, dict(limits), dict(resources), len(stations))


def _utc(value: Any) -> datetime:
    if not isinstance(value, str):
        raise DiscoveryError("time_invalid")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise DiscoveryError("time_invalid") from None
    if parsed.tzinfo is None:
        raise DiscoveryError("time_invalid")
    return parsed.astimezone(timezone.utc)


def read_time(raw: Any, connection_ref: str, *, sent_wall: float, received_wall: float, observed_at: float) -> TimeObservation:
    if not isinstance(raw, Mapping) or set(raw) != _TIME_KEYS or not _int(raw["schema_version"]) or raw["schema_version"] != SCHEMA_VERSION:
        raise DiscoveryError("time_invalid")
    limits = [raw["max_ts_skew_seconds"], raw["max_issued_future_seconds"], raw["max_command_ttl_seconds"]]
    if not all(_int(v) and v >= 0 for v in limits) or limits[2] < 1:
        raise DiscoveryError("time_invalid")
    server = _utc(raw["server_utc"]).timestamp()
    skew = server - (sent_wall + received_wall) / 2.0
    return TimeObservation(connection_ref, skew, limits[0], limits[1], limits[2], observed_at)


Call = Callable[[str, Mapping[str, Any]], Awaitable[Any]]


class DirectDiscovery:
    """Discovery state of ONE direct command session. Bound to the connection_ref it was read on; `refresh` is called on the session
    loop by the join (between requests, never inside one) and never raises."""

    def __init__(self, *, wall: Callable[[], float] = time.time, mono: Callable[[], float] = time.monotonic,
                 window_s: int = bridge.WINDOW_S) -> None:
        self._wall = wall
        self._mono = mono
        self.window_s = window_s
        self.capabilities: Capabilities | None = None
        self.time: TimeObservation | None = None
        self.failed_ref: str | None = None  # a connection whose discovery failed is not asked again (a new connection is)
        self.last_error: str | None = None

    def __repr__(self) -> str:
        return f"DirectDiscovery(ready={self.capabilities is not None}, error={self.last_error!r})"

    def stale(self) -> bool:
        t = self.time
        return t is None or self._mono() - t.observed_at >= TIME_RECHECK_S

    def forget(self) -> None:
        self.capabilities = self.time = None
        self.failed_ref = None

    async def refresh(self, connection_ref: str, call: Call) -> None:
        if self.capabilities is not None and self.capabilities.connection_ref != connection_ref:
            self.capabilities = self.time = None  # reconnect = new owner: nothing of the old document is kept
        if self.failed_ref == connection_ref:
            return
        try:
            if self.capabilities is None:
                self.capabilities = read_capabilities(await call(CAPABILITIES, {}), connection_ref)
            t = self.time
            if t is None or t.connection_ref != connection_ref or self._mono() - t.observed_at >= TIME_RECHECK_S:
                sent = self._wall()
                raw = await call(TIME, {})
                self.time = read_time(raw, connection_ref, sent_wall=sent, received_wall=self._wall(), observed_at=self._mono())
            self.last_error = None
        except DiscoveryError as exc:
            self._fail(connection_ref, exc.code)
        except bridge.MediaBridgeError as exc:
            self._fail(connection_ref, f"discovery_{exc.outcome}:{exc.code}"[:64])
        except Exception as exc:  # noqa: BLE001 - discovery failing only means "not selected"
            self._fail(connection_ref, f"discovery_error:{type(exc).__name__}"[:64])

    def _fail(self, connection_ref: str, code: str) -> None:
        self.capabilities = self.time = None
        self.failed_ref = connection_ref
        self.last_error = code

    def transport_refusal(self, connection_ref: str, command: str | None = None) -> str | None:
        """None when the direct path may carry `command` (or any discovered command) on this connection now; else the reason."""
        cap, t = self.capabilities, self.time
        if cap is None or t is None or cap.connection_ref != connection_ref or t.connection_ref != connection_ref:
            return self.last_error or "discovery_missing"
        reason = t.admits(self.window_s)
        if reason is not None:
            return reason
        if command is not None and not cap.lists(command):
            return "command_not_discovered"
        return None

    def snapshot(self) -> dict[str, Any]:
        """Counters for a diagnostics view (no names of stations, no secrets)."""
        cap, t = self.capabilities, self.time
        return {"ready": cap is not None and t is not None, "commands": len(cap.commands) if cap else 0,
                "families": len(cap.families) if cap else 0, "stations": cap.stations if cap else 0,
                "skew_s": round(t.skew_s, 3) if t else None, "last_error": self.last_error}
