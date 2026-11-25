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
Status: implemented and tested against the in-memory fake direct server only (tests/test_wkr5_295.py).

WISKEY-DIRECT-V2-2520 (row R7): on a v2 connection (DirectLink.protocol_version == 2) discovery reads `direct/capabilities_v3`, `direct/time`
and `direct/pairing_status_v2` instead (WisKey rc19 `direct_bridge_discovery.capabilities(version=3)`, contract
`direct--pairing_status_v2`). The v3 document must name the v2 protocol on every command and carry `transport_authentication` exactly
`{version: 2, kid: <this connection's kid>, rotation_source: "smplwise_bridge.KeySet", fallback_after_key_refusal: false}`
(`transport_auth_mismatch` otherwise). The pairing status must be the ONE current pairing Arx signed with - verified, arx_to_native,
protocol 2, the same kid, source the loaded bridge KeySet (`pairing_mismatch` otherwise; PAIRING-Q2 = a: nothing is selected silently).
Its `freshness_s` (60) bounds how long the observation is used before it is read again; it renews nothing. The v3 blocks
`native_installation` and `manual_service_write` are observations only (they grant nothing in Arx). Without all three reads, the direct
path is not selected on that connection."""
from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Mapping

from . import wiskey_media_bridge as bridge

log = logging.getLogger("smplwise.wiskey_direct_discovery")

CAPABILITIES = "direct/capabilities"
TIME = "direct/time"
# WISKEY-DIRECT-V2-2520: the v2 connection's discovery reads (direct-only READs of WisKey `DIRECT_READ_COMMANDS`)
CAPABILITIES_V3 = "direct/capabilities_v3"
PAIRING_STATUS_V2 = "direct/pairing_status_v2"
SCHEMA_VERSION = 1
# WisKey admits a signed request while |ts - now| <= max_ts_skew, issued_at <= now + max_issued_future and now < expires_at
# (issued_at + Arx's window). Arx signs with its OWN clock, so it keeps these margins in hand on each side:
BEHIND_MARGIN_S = 2.0  # server ahead of Arx: skew + margin must stay below Arx's window (else a request expires on arrival)
AHEAD_MARGIN_S = 0.5  # Arx ahead of the server: skew + margin must stay within max_issued_future
TIME_RECHECK_S = 600.0  # a time observation older than this is read again (the observation never renews anything)
READ_TIMEOUT_S = 6.0
_CAP_KEYS = {"schema_version", "protocol", "families", "commands", "limits", "station_media_contract", "stations", "resources",
             "lifecycle", "physical_result"}
# WISKEY-MAC-ADOPT-298 item E: the FINAL capabilities document (Mac 27.10, product CODE d5a3ab86, CURRENT_SIMULATOR_PROFILE.json) adds three
# closed, additive top-level blocks while staying schema_version 1. Each is optional (an older WisKey omits them); any OTHER key is refused.
_CAP_OPTIONAL = {"business_contracts", "native_service_write", "station_talk_audio"}
SERVICE_WRITE_CAP = {"contract": "wiskey-native-service-write.v1", "schema_version": 1,
                     "commands": ["users/create", "users/pin_generate", "users/temporary_cancel", "users/update"],
                     "metadata_parameter": "service_write", "grant_source": "owner pairing options.native_service_grants_v1",
                     "default_authority": "denied_without_current_native_owner_grant"}
# WISKEY-RC10-PIN-2382: WisKey 2.0.1-rc.10 (`direct_bridge_discovery.py`, docs/integrations/wiskey/catalog/rc10-extract) adds ONE key to
# the same v1 block: `installation_contract: "wiskey-native-service-write.v2"` (the contract of the grant WisKey derives from its own
# automatic installation). Everything else is byte-for-byte the v1 block. Reader revision 3 accepts exactly these two closed shapes; any
# other key or value is still another contract (rejected, never guessed). The v2 name is recorded as an observation only - it grants
# nothing in Arx and changes no installation policy (policy B).
SERVICE_WRITE_INSTALLATION_CONTRACT = "wiskey-native-service-write.v2"
SERVICE_WRITE_CAP_RC10 = {**SERVICE_WRITE_CAP, "installation_contract": SERVICE_WRITE_INSTALLATION_CONTRACT}
SERVICE_WRITE_SHAPES = (SERVICE_WRITE_CAP, SERVICE_WRITE_CAP_RC10)
TALK_AUDIO_CAP = {"schema": "arx.station_talk_audio.v1", "transport": "signed_ws_pcmu_v1", "opt_in": "media/talk_open.parameters.listen",
                  "default": False}
# WISKEY-RC4-2310 (WisKey owner30 contribution, rc.4): reader revision 2 names the two closed historical v1 shapes explicitly - the core
# alone, and the core plus all three metadata blocks that Native already emits. This reader accepts both (and, per review M3, an older
# WisKey that omits some blocks); any other top-level key is still refused. No wire document changes.
READER_REVISION = 3  # 3: WISKEY-RC10-PIN-2382 - the rc.10 `native_service_write` block (one added key) is read too
_NATIVE_V1_KEYS = _CAP_KEYS | _CAP_OPTIONAL
_CMD_KEYS = {"name", "envelope", "api_contract", "explicit_parameter_version"}
_TIME_KEYS = {"schema_version", "server_utc", "max_ts_skew_seconds", "max_issued_future_seconds", "max_command_ttl_seconds"}
_LIFECYCLE_V1 = {"kid_in_v1": False, "event_cursor_resume": False, "reconnect_adopts_old_resources": False}
_NAME_RE = re.compile(r"^[a-z0-9_]+(?:/[a-z0-9_]+)*$")  # `overview` and `subscribe` are single-segment names
# WISKEY-DIRECT-V2-2520: the v3 document (on a v2 connection)
SCHEMA_VERSION_V3 = 3
_CAP_REQUIRED_V3 = _CAP_KEYS | {"transport_authentication"}
_CAP_OPTIONAL_V3 = _CAP_OPTIONAL | {"native_installation", "manual_service_write"}
ROTATION_SOURCE = "smplwise_bridge.KeySet"
_LIFECYCLE_V2 = {"pairing_rotation": "old_connection_invalidated_reconnect_required", "kid_in_v1": False,
                 "reconnect_adopts_old_resources": False}  # `event_cursor_resume` is an observation (true on rc19 v2/v3)
MANUAL_SERVICE_WRITE_V3 = {"contract": "wiskey-native-service-write.v3", "read": "service_grants/current_v3",
                           "writer": "genuine_HA_owner_service_grants_preview_commit_v3", "created_on_startup": False}
PAIRING_FORMAT = "wiskey-pairing-status.v2"
PAIRING_FRESHNESS_S = 60
_PAIRING_KEYS = {"format", "verified", "direction", "protocol_version", "kid", "verified_at", "freshness_s", "principal_kind", "source"}
PAIRING_SOURCES = {1: "loaded_smplwise_bridge_legacy_entry", 2: "loaded_smplwise_bridge_keyset"}
_KID_RE = re.compile(r"^g[0-9]{1,9}-(?:legacy|[0-9a-f]{8})$")


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
    # WISKEY-MAC-ADOPT-298 item E: observations of the final document (never authority: a contract is used only by its own caller)
    business_contracts: Mapping[str, Any] = field(default_factory=dict, repr=False)
    service_write: bool = False  # `native_service_write` offered exactly as wiskey-native-service-write.v1
    talk_audio: bool = False  # `station_talk_audio` offered exactly as arx.station_talk_audio.v1 (opt-in, default off)
    # WISKEY-RC10-PIN-2382: the rc.10 block's `installation_contract` (None for the historical v1 block) - an observation, never authority
    service_write_installation_contract: str | None = None
    rejected_blocks: tuple[str, ...] = ()  # optional blocks present but not read (malformed / another contract): their feature is off
    # WISKEY-DIRECT-V2-2520: the transport the document was read for (2: a v3 document on a v2 connection, bound to `kid`)
    protocol_version: int = 1
    kid: str | None = None
    manual_service_write_v3: bool = False  # `manual_service_write` offered exactly as WisKey rc19's v3 block (observation only)
    native_installation_offered: bool = False  # rc19 `native_installation` present (observation only: it grants nothing in Arx)

    def lists(self, command: str) -> bool:
        return command in self.commands


@dataclass(frozen=True)
class PairingStatus:
    """WISKEY-DIRECT-V2-2520: one `direct/pairing_status_v2` answer (closed `PairingStatus` schema). An observation of which pairing
    WisKey verified THIS request against; it grants and renews nothing."""

    connection_ref: str
    protocol_version: int
    kid: str | None
    source: str
    verified_at: str
    freshness_s: int
    observed_at: float  # local monotonic

    def binding_refusal(self, protocol_version: int, kid: str | None) -> str | None:
        """None when this is exactly the one current pairing Arx signed with on a connection of `protocol_version` / `kid`, else
        `pairing_mismatch` (PAIRING-Q2 = a: never another pairing, never a silent choice)."""
        if (self.protocol_version != protocol_version or self.kid != (kid if protocol_version == 2 else None)
                or self.source != PAIRING_SOURCES.get(protocol_version)):
            return "pairing_mismatch"
        return None

    def view(self) -> dict[str, Any]:
        return {"protocol_version": self.protocol_version, "kid": self.kid, "source": self.source, "verified_at": self.verified_at,
                "freshness_s": self.freshness_s}


def read_pairing_status(raw: Any, connection_ref: str, *, observed_at: float) -> PairingStatus:
    """The closed `wiskey-pairing-status.v2` document, or DiscoveryError(`pairing_status_invalid`). Schema only; the binding to the
    connection's own key is `PairingStatus.binding_refusal`."""
    if not isinstance(raw, Mapping) or set(raw) != _PAIRING_KEYS:
        raise DiscoveryError("pairing_status_invalid")
    version, kid, at = raw["protocol_version"], raw["kid"], raw["verified_at"]
    if (raw["format"] != PAIRING_FORMAT or raw["verified"] is not True or raw["direction"] != "arx_to_native"
            or raw["principal_kind"] != bridge.DIRECT_PRINCIPAL_KIND or not _int(raw["freshness_s"]) or raw["freshness_s"] != PAIRING_FRESHNESS_S
            or not _int(version) or version not in (1, 2) or raw["source"] not in PAIRING_SOURCES.values()
            or not (kid is None or (isinstance(kid, str) and _KID_RE.fullmatch(kid)))
            or not isinstance(at, str) or not 1 <= len(at) <= 64):
        raise DiscoveryError("pairing_status_invalid")
    try:
        _utc(at)
    except DiscoveryError:
        raise DiscoveryError("pairing_status_invalid") from None
    return PairingStatus(connection_ref, version, kid, raw["source"], at, raw["freshness_s"], observed_at)


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


def read_capabilities(raw: Any, connection_ref: str, *, protocol_version: int = 1, kid: str | None = None) -> Capabilities:
    """The closed schema_version-1 document, or DiscoveryError. Every command entry's `envelope` must be the transport protocol.
    WISKEY-DIRECT-V2-2520: `protocol_version=2` reads the schema_version-3 document of a v2 connection instead (see the module note);
    its `transport_authentication` must name exactly this connection's `kid`."""
    v2 = protocol_version == 2
    if protocol_version not in (1, 2):
        raise DiscoveryError("capabilities_unsupported")
    required, optional = (_CAP_REQUIRED_V3, _CAP_OPTIONAL_V3) if v2 else (_CAP_KEYS, _CAP_OPTIONAL)
    protocol = bridge.DIRECT_PROTOCOL_V2 if v2 else bridge.DIRECT_PROTOCOL
    if not isinstance(raw, Mapping) or not required <= set(raw) <= required | optional:
        raise DiscoveryError("capabilities_invalid")
    if (not _int(raw["schema_version"]) or raw["schema_version"] != (SCHEMA_VERSION_V3 if v2 else SCHEMA_VERSION)
            or raw["protocol"] != protocol):
        raise DiscoveryError("capabilities_unsupported")
    if v2:
        auth = raw["transport_authentication"]
        if (not isinstance(kid, str) or not isinstance(auth, Mapping)
                or dict(auth) != {"version": 2, "kid": kid, "rotation_source": ROTATION_SOURCE, "fallback_after_key_refusal": False}
                or type(auth["version"]) is not int or auth["fallback_after_key_refusal"] is not False):
            raise DiscoveryError("transport_auth_mismatch")
    commands = raw["commands"]
    if not isinstance(commands, list):
        raise DiscoveryError("capabilities_invalid")
    names: list[str] = []
    versions: dict[str, int | None] = {}
    for c in commands:
        if not isinstance(c, Mapping) or set(c) != _CMD_KEYS or not isinstance(c["name"], str) or not _NAME_RE.fullmatch(c["name"]):
            raise DiscoveryError("capabilities_invalid")
        if c["envelope"] != protocol:  # W5-API-01: a transport protocol, never a bridge.kind
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
    if not isinstance(lifecycle, Mapping) or any(lifecycle.get(k) is not v for k, v in _LIFECYCLE_V1.items() if not (v2 and k == "event_cursor_resume")):
        raise DiscoveryError("lifecycle_unsupported")
    if v2 and (any(lifecycle.get(k) != v for k, v in _LIFECYCLE_V2.items()) or type(lifecycle.get("event_cursor_resume")) is not bool):
        raise DiscoveryError("lifecycle_unsupported")
    limits, resources, stations = raw["limits"], raw["resources"], raw["stations"]
    if not isinstance(limits, Mapping) or not isinstance(resources, Mapping) or not isinstance(stations, list):
        raise DiscoveryError("capabilities_invalid")
    if raw["physical_result"] != "unproven":  # discovery never claims a physical fact
        raise DiscoveryError("capabilities_invalid")
    # review M3: each OPTIONAL block is judged on its own. A malformed or different block is not offered (its feature stays off, the
    # block is named in `rejected_blocks`) - it never fails the discovery of the core document, whose closed checks above still hold.
    rejected: list[str] = []
    contracts = raw.get("business_contracts", {})
    if not isinstance(contracts, Mapping) or not all(isinstance(k, str) and isinstance(v, Mapping) for k, v in contracts.items()):
        rejected.append("business_contracts")
        contracts = {}
    service = raw.get("native_service_write")
    if service is not None and (not isinstance(service, Mapping) or dict(service) not in SERVICE_WRITE_SHAPES):
        rejected.append("native_service_write")  # another service-write contract is a new contract: never guessed, never used
        service = None
    talk_audio = raw.get("station_talk_audio")
    if talk_audio is not None and (not isinstance(talk_audio, Mapping) or dict(talk_audio) != TALK_AUDIO_CAP):
        rejected.append("station_talk_audio")
        talk_audio = None
    manual_v3 = raw.get("manual_service_write")
    if manual_v3 is not None and (not isinstance(manual_v3, Mapping) or dict(manual_v3) != MANUAL_SERVICE_WRITE_V3
                                  or manual_v3.get("created_on_startup") is not False):
        rejected.append("manual_service_write")
        manual_v3 = None
    installation = raw.get("native_installation")
    if installation is not None and not isinstance(installation, Mapping):
        rejected.append("native_installation")
        installation = None
    if rejected:
        log.warning("wiskey discovery: optional capabilities blocks not offered as read: %s", ",".join(rejected))
    return Capabilities(connection_ref, frozenset(names), tuple(families), versions, dict(limits), dict(resources), len(stations),
                        business_contracts={k: dict(v) for k, v in contracts.items()}, service_write=service is not None,
                        talk_audio=talk_audio is not None, rejected_blocks=tuple(rejected),
                        service_write_installation_contract=None if service is None else service.get("installation_contract"),
                        protocol_version=protocol_version, kid=kid if v2 else None, manual_service_write_v3=manual_v3 is not None,
                        native_installation_offered=installation is not None)


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
        self.pairing: PairingStatus | None = None  # WISKEY-DIRECT-V2-2520: the v2 connection's pairing observation (None on v1)

    def __repr__(self) -> str:
        return f"DirectDiscovery(ready={self.capabilities is not None}, error={self.last_error!r})"

    def stale(self) -> bool:
        t = self.time
        if t is None or self._mono() - t.observed_at >= TIME_RECHECK_S:
            return True
        cap, p = self.capabilities, self.pairing
        if cap is not None and cap.protocol_version == 2:
            return p is None or self._mono() - p.observed_at >= p.freshness_s
        return False

    def forget(self) -> None:
        self.capabilities = self.time = self.pairing = None
        self.failed_ref = None

    async def refresh(self, connection_ref: str, call: Call, *, protocol_version: int = 1, kid: str | None = None) -> None:
        """Read what this connection lacks (never raises). `protocol_version` / `kid` are the CONNECTION's (DirectLink), never taken
        from a document: on v2 the v3 document and the pairing status must match them."""
        cap = self.capabilities
        if cap is not None and (cap.connection_ref != connection_ref or cap.protocol_version != protocol_version or cap.kid != kid):
            self.capabilities = self.time = self.pairing = None  # reconnect = new owner: nothing of the old document is kept
        if self.failed_ref == connection_ref:
            return
        v2 = protocol_version == 2
        try:
            if self.capabilities is None:
                self.capabilities = read_capabilities(await call(CAPABILITIES_V3 if v2 else CAPABILITIES, {}), connection_ref,
                                                      protocol_version=protocol_version, kid=kid)
            t = self.time
            if t is None or t.connection_ref != connection_ref or self._mono() - t.observed_at >= TIME_RECHECK_S:
                sent = self._wall()
                raw = await call(TIME, {})
                self.time = read_time(raw, connection_ref, sent_wall=sent, received_wall=self._wall(), observed_at=self._mono())
            p = self.pairing
            if v2 and (p is None or p.connection_ref != connection_ref or self._mono() - p.observed_at >= p.freshness_s):
                self.pairing = None
                status = read_pairing_status(await call(PAIRING_STATUS_V2, {}), connection_ref, observed_at=self._mono())
                refusal = status.binding_refusal(protocol_version, kid)
                if refusal is not None:
                    raise DiscoveryError(refusal)
                self.pairing = status
            self.last_error = None
        except DiscoveryError as exc:
            self._fail(connection_ref, exc.code)
        except bridge.MediaBridgeError as exc:
            self._fail(connection_ref, f"discovery_{exc.outcome}:{exc.code}"[:64])
        except Exception as exc:  # noqa: BLE001 - discovery failing only means "not selected"
            self._fail(connection_ref, f"discovery_error:{type(exc).__name__}"[:64])

    def _fail(self, connection_ref: str, code: str) -> None:
        self.capabilities = self.time = self.pairing = None
        self.failed_ref = connection_ref
        self.last_error = code

    def transport_refusal(self, connection_ref: str, command: str | None = None) -> str | None:
        """None when the direct path may carry `command` (or any discovered command) on this connection now; else the reason."""
        cap, t = self.capabilities, self.time
        if cap is None or t is None or cap.connection_ref != connection_ref or t.connection_ref != connection_ref:
            return self.last_error or "discovery_missing"
        if cap.protocol_version == 2:
            p = self.pairing
            if p is None or p.connection_ref != connection_ref:
                return self.last_error or "pairing_unverified"
            if self._mono() - p.observed_at >= p.freshness_s:
                return "pairing_stale"
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
