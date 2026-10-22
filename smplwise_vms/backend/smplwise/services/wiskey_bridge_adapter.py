"""WKBRIDGE-295: the ONE adapter module for WisKey round 3 (docs/changes/CR-WKBRIDGE295.md).

WisKey's plan (repository C:/hik intercom @ acc6509111ae2afbd2d54b620709960208d7e6c8, docs/owner-development-2026-10-23/arx-round3-mac-plan/,
PLANNING ONLY - nothing below is implemented or published by WisKey yet): Arx gets full WisKey access ONLY through the authenticated Arx
bridge principal (no HA admin), over a new signed command route that reuses the EXISTING bridge field and pairing signature:

  envelope  {id, type, bridge}                      id exact int 1..2^53-1, type = "hikvision_intercom/" + command
  bridge    {kind, command, query_owner_id, issued_at, expires_at, parameters} + ts, nonce, sig
            kind = "wiskey-bridge-command.v1", every command detail inside the SIGNED `parameters` (no competing outer copy)

Every wire field / name / bound that WisKey has not yet published on an implementation SHA is marked ASSUMED-PENDING-WISKEY-SHA here, and
ONLY here: when WisKey publishes the final shapes this module is the single place to change. Nothing calls it yet (no route, no switch).

Two halves:
  1. `build_command` - the generic signed-command builder. The signature is the existing bridge recipe (services/ha_bridge.sign with
     ha_bridge.signing_key: the pairing secret, or the key set's adopted `g0-legacy`), byte-compatible with WisKey's verifier
     (HMAC-SHA256 over "<ts>.<nonce>.<sha256(canonical body)>", canonical = sorted keys, compact separators, ensure_ascii=False).
     It never produces the read kind `wiskey-peer-query.v1` and refuses every read command suffix, so the read path is not widened.
     Allow-listed commands only, each with its exact parameter key set; floats / non-finite numbers / non-str keys refused; the signed
     window 0 < expires_at - issued_at <= 15 s; the wire request <= 65536 bytes. Parameter VALUES (a raw PIN, a name, a card, audio) are
     never logged, audited, put into an exception or a repr: `SignedCommand.audit_fields()` names the parameter KEYS only.
  2. `authority_snapshot` - the policy snapshot Arx can supply for WisKey's T06 `authority_revision`: {revision, issued_at, expires_at,
     grants...} derived from Arx RBAC as it really is (rbac.authorize per station and per station permission, deny-overrides, the
     user's active flag), with `revision` from the monotonic counter of migration 0150 (PROVISIONAL number), read before and after the
     grants so a snapshot never mixes two revisions.
"""
from __future__ import annotations

import json
import re
import secrets
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

# ---------------------------------------------------------------- wire constants (ASSUMED-PENDING-WISKEY-SHA unless noted)

DOMAIN = "hikvision_intercom"                       # existing (peer_query spec 2026-10-22)
COMMAND_KIND = "wiskey-bridge-command.v1"           # ASSUMED-PENDING-WISKEY-SHA: planned name (MAC_CONTINUE_24H_FULL_HE P0.2)
READ_KIND = "wiskey-peer-query.v1"                  # existing read kind: NEVER produced by this module
BODY_KEYS = frozenset({"kind", "command", "query_owner_id", "issued_at", "expires_at", "parameters"})  # ASSUMED-PENDING-WISKEY-SHA (planned closed body)
ENVELOPE_KEYS = frozenset({"id", "type", "bridge"})  # ASSUMED-PENDING-WISKEY-SHA (planned WS envelope for this route)
WIRE_FIELDS = frozenset({"ts", "nonce", "sig", "kid"})
MAX_WINDOW_S = 15                                   # ASSUMED-PENDING-WISKEY-SHA: planned "at most 15 s" (same as peer_query)
DEFAULT_WINDOW_S = 10
MAX_REQUEST_BYTES = 65536                           # ASSUMED-PENDING-WISKEY-SHA: the peer_query request cap, assumed for this route
MAX_ID = 2 ** 53 - 1
MAX_DEPTH = 8
# ASSUMED-PENDING-WISKEY-SHA: WisKey's peer verifier documents pairing v1 framing only (no `kid`). Until WisKey confirms key-ring v2
# on this route, a host whose current key is a rotated v2 key refuses to build (fail closed) instead of sending a frame WisKey may reject
# or, worse, silently downgrade.
ALLOW_KEYSET_V2 = False

# The existing read commands (peer_query spec 2026-10-22). Never accepted here: the read kind is not widened to mutations and this
# route is not a second door into the read path.
READ_COMMANDS = frozenset({"peer_identity/get", "peer_protocol/get", "peer_bindings/get", "peer_bindings/history", "users/access_state_v2",
                           "users/access_state", "peer_receipts/resolve"})

REF_RE = re.compile(r"^[A-Za-z0-9_-]{16,128}$")     # W10: opaque URL-safe refs, 16..128
HA_USER_RE = re.compile(r"^[0-9a-f]{32}$")          # query_owner_id: the original principal id, 32 lower hex
TALK_CLOSE_REASONS = frozenset({"stopped", "ended", "expired", "access_lost", "upstream_closed"})  # ASSUMED-PENDING-WISKEY-SHA (W10 plan)
MEDIA_PROFILES = frozenset({"sub", "main"})         # ASSUMED-PENDING-WISKEY-SHA (W10 plan)


def _id_ok(v: Any) -> bool:
    return isinstance(v, str) and 1 <= len(v) <= 128 and v.strip() != "" and not any(ord(c) < 32 or ord(c) == 127 for c in v)


def _ref_ok(v: Any) -> bool:
    return isinstance(v, str) and REF_RE.fullmatch(v) is not None


def _actor_ok(v: Any) -> bool:
    """W10: actor = {id, display_name}, the Arx actor (an Arx id, kept apart from the HA query_owner_id)."""
    return (isinstance(v, dict) and set(v) == {"id", "display_name"} and _id_ok(v["id"])
            and isinstance(v["display_name"], str) and len(v["display_name"]) <= 128)


def _instant_ok(v: Any) -> bool:
    if not isinstance(v, str) or len(v) > 40:
        return False
    try:
        return datetime.fromisoformat(v).tzinfo is not None
    except ValueError:
        return False


# The allow-list: command suffix -> {parameter key: validator}. EXACT key sets (a missing or extra key is refused).
# ASSUMED-PENDING-WISKEY-SHA, every entry: the W10 plan's parameter lists (W10_STATION_MEDIA_IMPLEMENTATION_HE.txt). Left out on
# purpose until WisKey publishes them: `media/talk_frame` (the 50 Hz frame plane / nonce budget is unresolved - W10 item 17; a
# per-frame signed command would exhaust the verifier's nonce cache), `whatsapp/template_send_v2` and the name_ref prepare/apply routes
# (their request fields are named only in the Mac prompt), and the policy-snapshot install command (not named yet).
COMMANDS: dict[str, dict[str, Any]] = {
    "media/station_descriptor": {"station_id": _id_ok, "actor": _actor_ok, "request_id": _id_ok},
    "media/stream_lease": {"session": _ref_ok, "profile": lambda v: v in MEDIA_PROFILES, "actor": _actor_ok, "request_id": _id_ok},
    "media/talk_open": {"session": _ref_ok, "actor": _actor_ok, "request_id": _id_ok, "expires_at": _instant_ok},
    "media/talk_floor": {"talk_ref": _ref_ok, "held": lambda v: type(v) is bool},
    "media/talk_close": {"talk_ref": _ref_ok, "reason": lambda v: isinstance(v, str) and v in TALK_CLOSE_REASONS},
}
if set(COMMANDS) & READ_COMMANDS:  # pragma: no cover - a guard at import, like backup.NEVER_EXPORTED_TABLES
    raise RuntimeError("a read command is listed as a bridge command")

# Names that must never be a top-level parameter: authority comes from the verified bridge principal, never from caller JSON
# (OWNER_FORWARD item 3: no fake User / consent / admin), and the wire fields belong to the proof, not to the parameters.
FORBIDDEN_PARAMETER_KEYS = frozenset({"principal", "user", "consent", "is_admin", "admin", "pairing", "guard", "kind", "command",
                                      "query_owner_id", "bridge", *WIRE_FIELDS})


class BridgeCommandError(ValueError):
    """A refused build. `code` is closed; the message never carries a parameter value, a key or a signature."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _json_safe(value: Any, depth: int = 0) -> bool:
    """JSON types only: no float (WisKey's canonical form has no floats / non-finite numbers), str keys, bounded depth."""
    if depth > MAX_DEPTH:
        return False
    if value is None or isinstance(value, (bool, str)):
        return True
    if isinstance(value, int):
        return -MAX_ID <= value <= MAX_ID
    if isinstance(value, float):
        return False
    if isinstance(value, list):
        return all(_json_safe(v, depth + 1) for v in value)
    if isinstance(value, dict):
        return all(isinstance(k, str) and _json_safe(v, depth + 1) for k, v in value.items())
    return False


def _iso(at: datetime) -> str:
    return at.astimezone(timezone.utc).isoformat()


@dataclass(frozen=True, repr=False)
class SignedCommand:
    """One built command. `wire()` is the frame to send; nothing else exposes the parameters."""

    id: int
    command: str
    issued_at: str
    expires_at: str
    _wire: str  # the JSON text of the envelope (kept as text so a caller cannot mutate the signed body after signing)
    _parameter_keys: tuple[str, ...]

    @property
    def type(self) -> str:
        return f"{DOMAIN}/{self.command}"

    def wire(self) -> dict[str, Any]:
        return json.loads(self._wire)

    def wire_text(self) -> str:
        return self._wire

    def audit_fields(self) -> dict[str, Any]:
        """What a log line or an audit row may carry: ids, names and times - the parameter KEYS, never their values."""
        return {"kind": COMMAND_KIND, "command": self.command, "id": self.id, "issued_at": self.issued_at, "expires_at": self.expires_at,
                "parameter_keys": list(self._parameter_keys)}

    def __repr__(self) -> str:
        return f"SignedCommand(command={self.command!r}, id={self.id})"

    __str__ = __repr__


def validate_parameters(command: Any, parameters: Any) -> None:
    """Raises BridgeCommandError unless `command` is allow-listed and `parameters` is exactly its closed key set with valid values."""
    if not isinstance(command, str):
        raise BridgeCommandError("unknown_command")
    if command in READ_COMMANDS:
        raise BridgeCommandError("read_command_refused")
    spec = COMMANDS.get(command)
    if spec is None:
        raise BridgeCommandError("unknown_command")
    if not isinstance(parameters, dict) or not _json_safe(parameters):
        raise BridgeCommandError("invalid_parameters")
    if set(parameters) & FORBIDDEN_PARAMETER_KEYS:
        raise BridgeCommandError("forbidden_parameter")
    if set(parameters) != set(spec):
        raise BridgeCommandError("invalid_parameters")
    for key, ok in spec.items():
        if not ok(parameters[key]):
            raise BridgeCommandError("invalid_parameters")


def build_body(command: str, parameters: dict[str, Any], *, query_owner_id: str, now: datetime, window_s: int = DEFAULT_WINDOW_S) -> dict[str, Any]:
    """The closed body that is signed (pure; no key involved)."""
    validate_parameters(command, parameters)
    if not isinstance(query_owner_id, str) or not HA_USER_RE.fullmatch(query_owner_id):
        raise BridgeCommandError("invalid_owner")
    if type(window_s) is not int or not 0 < window_s <= MAX_WINDOW_S:
        raise BridgeCommandError("invalid_window")
    if not isinstance(now, datetime) or now.tzinfo is None:
        raise BridgeCommandError("invalid_clock")
    body = {"kind": COMMAND_KIND, "command": command, "query_owner_id": query_owner_id, "issued_at": _iso(now),
            "expires_at": _iso(now + timedelta(seconds=window_s)), "parameters": json.loads(json.dumps(parameters, allow_nan=False))}
    assert set(body) == BODY_KEYS
    return body


def _signing_key(conn: sqlite3.Connection) -> str:
    from . import bridge_keys as bk
    from . import ha_bridge

    key = ha_bridge.signing_key(conn)
    if not key:
        raise BridgeCommandError("bridge_not_paired")
    if isinstance(key, ha_bridge.BridgeKey) and key.kid != bk.LEGACY_KID and not ALLOW_KEYSET_V2:
        raise BridgeCommandError("keyset_v2_unconfirmed")
    return key


def build_command(conn: sqlite3.Connection, *, request_id: int, command: str, parameters: dict[str, Any], query_owner_id: str,
                  now: datetime | None = None, window_s: int = DEFAULT_WINDOW_S, nonce: str | None = None) -> SignedCommand:
    """Build and sign one `wiskey-bridge-command.v1` frame with the EXISTING bridge key handling. Sends nothing, writes nothing,
    logs nothing. `now` / `nonce` are injectable for vectors only. `request_id` is the WS frame id (exact int 1..2^53-1)."""
    from . import ha_bridge

    if type(request_id) is not int or not 1 <= request_id <= MAX_ID:
        raise BridgeCommandError("invalid_id")
    now = now or datetime.now(timezone.utc)
    body = build_body(command, parameters, query_owner_id=query_owner_id, now=now, window_s=window_s)
    key = _signing_key(conn)
    nonce = nonce or secrets.token_hex(16)
    if not re.fullmatch(r"[0-9a-f]{32}", nonce):
        raise BridgeCommandError("invalid_nonce")
    ts = int(now.timestamp())
    try:
        proof = ha_bridge.sign(key, body, ts, nonce)
    except ValueError:
        raise BridgeCommandError("sign_failed") from None
    envelope = {"id": request_id, "type": f"{DOMAIN}/{command}", "bridge": proof}
    assert set(envelope) == ENVELOPE_KEYS and proof["kind"] == COMMAND_KIND and proof["kind"] != READ_KIND
    text = json.dumps(envelope, ensure_ascii=True, allow_nan=False)
    if len(text.encode("utf-8")) > MAX_REQUEST_BYTES:
        raise BridgeCommandError("request_too_large")
    return SignedCommand(id=request_id, command=command, issued_at=body["issued_at"], expires_at=body["expires_at"], _wire=text,
                         _parameter_keys=tuple(sorted(parameters)))


# ---------------------------------------------------------------- the authority policy snapshot (T06 authority_revision)

SNAPSHOT_SCHEMA = "arx-authority-snapshot.v1"   # ASSUMED-PENDING-WISKEY-SHA: WisKey "locks and publishes a numbered schema"
SNAPSHOT_KEYS = frozenset({"schema", "schema_version", "repository_id", "query_owner_id", "actor_ref", "revision", "issued_at",
                           "expires_at", "stations", "grants"})  # ASSUMED-PENDING-WISKEY-SHA (fields named in A06/M04 of the Mac plan)
GRANT_KEYS = frozenset({"grant_id", "station_id", "permission"})  # ASSUMED-PENDING-WISKEY-SHA
SNAPSHOT_DEFAULT_TTL_S = 60
SNAPSHOT_MAX_TTL_S = 300                         # ASSUMED-PENDING-WISKEY-SHA (Arx-side bound; WisKey names none yet)
SNAPSHOT_MAX_STATIONS = 1024
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


class SnapshotError(ValueError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def authority_revision(conn: sqlite3.Connection) -> int | None:
    """The monotonic authority revision (migration 0150), or None before the migration (never a guessed number)."""
    try:
        row = conn.execute("SELECT revision FROM arx_authority_revision WHERE id = 1").fetchone()
    except sqlite3.OperationalError:
        return None
    if row is None or type(row[0]) is not int or row[0] < 1:
        return None
    return int(row[0])


def authority_snapshot(conn: sqlite3.Connection, *, actor: Any, station_ids: Iterable[str], query_owner_id: str, repository_id: str,
                       now: datetime | None = None, ttl_s: int = SNAPSHOT_DEFAULT_TTL_S) -> dict[str, Any]:
    """What `actor` (an rbac.Principal: the Arx actor, never the HA query owner) may do at each listed WisKey station, as Arx RBAC
    decides it now: one grant per (station, station permission) that rbac.authorize allows, naming the binding that allows it.
    Deny-overrides, the active flag and the station chain are rbac's own. Raises SnapshotError(`not_installed`) before migration 0150
    and (`revision_moved`) when a permission change committed while the grants were being read (the caller retries)."""
    from .. import rbac

    if not isinstance(actor, rbac.Principal) or not _id_ok(actor.user_id):
        raise SnapshotError("invalid_actor")
    if not isinstance(query_owner_id, str) or not HA_USER_RE.fullmatch(query_owner_id):
        raise SnapshotError("invalid_owner")
    if not isinstance(repository_id, str) or not UUID_RE.fullmatch(repository_id):
        raise SnapshotError("invalid_repository")
    if type(ttl_s) is not int or not 0 < ttl_s <= SNAPSHOT_MAX_TTL_S:
        raise SnapshotError("invalid_ttl")
    try:
        stations = sorted(set(station_ids)) if not isinstance(station_ids, (str, bytes, dict)) else None
    except TypeError:
        stations = None
    if stations is None or len(stations) > SNAPSHOT_MAX_STATIONS or not all(_id_ok(s) for s in stations):
        raise SnapshotError("invalid_stations")
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise SnapshotError("invalid_clock")
    before = authority_revision(conn)
    if before is None:
        raise SnapshotError("not_installed")
    grants: list[dict[str, str]] = []
    for sid in stations:
        for perm in sorted(rbac.STATION_PERMISSIONS):
            d = rbac.authorize(conn, actor, perm, (rbac.STATION, sid))
            if d.allowed and d.binding_id:
                grants.append({"grant_id": d.binding_id, "station_id": sid, "permission": perm})
    if authority_revision(conn) != before:
        raise SnapshotError("revision_moved")
    snap = {"schema": SNAPSHOT_SCHEMA, "schema_version": 1, "repository_id": repository_id, "query_owner_id": query_owner_id,
            "actor_ref": actor.user_id, "revision": before, "issued_at": _iso(now), "expires_at": _iso(now + timedelta(seconds=ttl_s)),
            "stations": stations, "grants": grants}
    assert set(snap) == SNAPSHOT_KEYS and all(set(g) == GRANT_KEYS for g in grants)
    return snap


def snapshot_current(snapshot: Any, conn: sqlite3.Connection, now: datetime | None = None) -> bool:
    """Arx-side check before a snapshot is handed on: unexpired and still at the current authority revision (False otherwise)."""
    if not isinstance(snapshot, dict) or set(snapshot) != SNAPSHOT_KEYS:
        return False
    now = now or datetime.now(timezone.utc)
    try:
        expires = datetime.fromisoformat(snapshot["expires_at"])
    except (TypeError, ValueError):
        return False
    rev = snapshot.get("revision")
    if expires.tzinfo is None:
        return False
    return type(rev) is int and rev == authority_revision(conn) and now < expires
