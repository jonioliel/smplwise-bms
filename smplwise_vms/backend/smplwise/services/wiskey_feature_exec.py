"""ECCACT-295 (directive items 3 and 4): the Arx half of `wiskey-arx-feature-execution.v1` for the six WisKey execution adapters
(door windows, emergency, door automations, people/CSV, live media, live validation).

What WisKey asks of Arx (Mac delivery f66bf67b, access/arx_feature_execution_contract.py + arx_execution_authority.py, read as DATA)
- a strict REQUEST: exactly the closed field set, bounded references, wire admission <= 15 s, an execution deadline that equals the
  draft's own end / expiry, an actor that is a human (all features but door automations) or an automation with creator, approver and a
  grant revision equal to the authority revision;
- a CURRENT POLICY, resolved from Arx's own authority and never from the request: the WisKey permission strings the coordinators
  require (door/pulse, door/hold_open, door/restore, door/emergency_*, media/*, people/write, validation/*), the COMPLETE set of
  stations with their api relay, physical relay and mapping revision, and for people/CSV the row grants. An incomplete policy is
  refused by WisKey; Arx therefore never produces a partial one (`complete` is False and the document says why).

What this module is
- `build_request` builds that request and refuses (before anything is stored or sent) whatever WisKey's parser would refuse.
- `resolve_policy` turns Arx RBAC (station-chain `Authority`, deny wins) plus Arx's relay map into the policy document. The actor of
  the request is the Arx user; a service identity is never the actor and never contributes a permission.
- `admit_request` records the durable intent (wiskey_feature_intents) BEFORE any I/O; a request id is never admitted twice, so there is
  no replay. The outcome stays `unknown` until a verified answer says otherwise.
- the relay map and the feature registry (migration 0145) are explicit operator facts: nothing is derived silently, and
  `host_registered` is recorded only from a verified answer of the WisKey host.

What it is not
- No transport: `LiveFeatureTransport` refuses `not_built`. The route, envelope, signature path and the service identity of the
  verified bridge are a JOINT PIN with the Mac (2026-10-21); WisKey f66bf67b installs no HA route for these ports. Until then a
  request can be built, stored and judged but not delivered, and every feature reports `blocked: joint_pin_transport`.
- No physical effect is created here, and no mapping is invented: a station without a confirmed relay map yields an incomplete policy."""
from __future__ import annotations

import re
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Iterable

from ..rbac import Principal
from . import wiskey_peer as wp
from .intercom_authority import Authority

CONTRACT = "wiskey-arx-feature-execution.v1"
FEATURE_FIELDS = frozenset({
    "contract_version", "feature", "request_id", "operation_id", "operation_binding_ref", "actor", "authority_ref", "authority_revision",
    "scope_ref", "parameter_reference", "issued_at", "request_expires_at", "execution_expires_at", "params"})
AUTOMATION_ACTOR_FIELDS = frozenset({"kind", "automation_id", "run_id", "trigger_id", "creator_user_id", "approver_user_id", "grant_revision"})
# WisKey arx_feature_plans.REQUIREMENTS (f66bf67b): the closed parameter set of every feature
REQUIREMENTS: dict[str, tuple[str, ...]] = {
    "door_windows": ("station_id", "relay", "mapping_revision", "start", "end", "timezone"),
    "emergency_buttons": ("station_id", "relay", "mapping_revision", "policy_ref"),
    "door_automations": ("station_id", "relay", "mapping_revision", "automation_ref", "expiry"),
    "people_csv": ("preview_ref", "ownership_policy_ref", "revision_policy_ref"),
    "live_media": ("station_id", "direction", "consent_ref", "expiry"),
    "live_validation": ("checklist_ref", "owner_go_ref", "expiry"),
}
FEATURES = tuple(REQUIREMENTS)
MAX_TTL_S = 15
DEFAULT_TTL_S = 10
INT_PARAMS = ("relay", "mapping_revision")
DIRECTIONS = ("video_only", "two_way_audio")
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")

# WisKey permission string -> the Arx permission that must be held ON EVERY station of the scope (deny wins, station chain).
# door/emergency_release is held by whoever may secure OR open (releasing only returns doors to their schedule).
ARX_PERMISSION_OF: dict[str, tuple[str, ...]] = {
    "door/pulse": ("access.doors.open",),
    "door/hold_open": ("access.windows.manage", "access.emergency.open"),
    "door/restore": ("access.windows.manage", "access.emergency.open", "access.emergency.lock"),
    "door/emergency_secure": ("access.emergency.lock",),
    "door/emergency_open": ("access.emergency.open",),
    "door/emergency_release": ("access.emergency.lock", "access.emergency.open"),
    "media/video_receive": ("access.stations.read",),
    "media/audio_receive": ("access.call",),
    "media/microphone_send": ("access.call",),
    "people/write": ("access.people.manage",),
    "validation/run": ("access.stations.manage",),
    "validation/identity": ("access.stations.read",),
    "validation/door_capabilities": ("access.stations.read",),
    "validation/door_read": ("access.stations.read",),
    "validation/media": ("access.call",),
}
# which WisKey permissions a feature's coordinator may require (the policy offers exactly these, never more)
PERMISSIONS_OF_FEATURE: dict[str, tuple[str, ...]] = {
    "door_windows": ("door/hold_open", "door/restore"),
    "emergency_buttons": ("door/emergency_secure", "door/emergency_open", "door/emergency_release", "door/hold_open", "door/restore"),
    "door_automations": ("door/pulse", "door/hold_open", "door/restore"),
    "people_csv": ("people/write",),
    "live_media": ("media/video_receive", "media/audio_receive", "media/microphone_send"),
    "live_validation": ("validation/run", "validation/identity", "validation/door_capabilities", "validation/door_read", "validation/media", "door/pulse"),
}
# door automations are judged on BOTH scopes by the owner decision (creator and approver each hold the permission on the station)
STATION_SCOPED = frozenset({"door_windows", "emergency_buttons", "door_automations", "live_media"})
TRANSPORT_BLOCK = "joint_pin_transport"


class FeatureError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _ref(value: Any) -> bool:
    return wp.is_ref(value)


def _utc(value: datetime) -> str:
    v = value.astimezone(timezone.utc)
    return v.strftime("%Y-%m-%dT%H:%M:%S.%fZ") if v.microsecond else v.strftime("%Y-%m-%dT%H:%M:%SZ")


def absolute_time(value: Any) -> datetime:
    """WisKey's `absolute_time`: a bounded aware ISO instant in 1970..2037, normalised to UTC."""
    if type(value) is not str or not 1 <= len(value) <= 128:
        raise FeatureError("invalid_validity")
    try:
        point = datetime.fromisoformat(value)
        if point.tzinfo is None:
            raise ValueError
        point = point.astimezone(timezone.utc)
        if not datetime(1970, 1, 1, tzinfo=timezone.utc) <= point <= datetime(2037, 12, 31, 23, 59, 59, tzinfo=timezone.utc):
            raise ValueError
        return point
    except (ValueError, OverflowError):
        raise FeatureError("invalid_validity") from None


def validate_params(feature: str, params: Any) -> dict[str, Any]:
    """Exactly WisKey's `plan()` checks (closed set, types, bounds) so a request WisKey would refuse is never stored or sent."""
    if feature not in REQUIREMENTS:
        raise FeatureError("unknown_feature")
    if not isinstance(params, dict) or set(params) != set(REQUIREMENTS[feature]):
        raise FeatureError("invalid_fields")
    out: dict[str, Any] = {}
    for name, value in params.items():
        if name in INT_PARAMS:
            if type(value) is not int or value < 1 or value > wp.MAX_JSON_INT or (name == "relay" and value > 2):
                raise FeatureError("invalid_fields")
        elif not isinstance(value, str) or not 1 <= len(value) <= 128 or any(ord(c) < 32 for c in value):
            raise FeatureError("invalid_fields")
        out[name] = value
    if feature == "live_media" and out["direction"] not in DIRECTIONS:
        raise FeatureError("invalid_fields")
    if feature == "door_windows":
        start, end = absolute_time(out["start"]), absolute_time(out["end"])
        if end <= start:
            raise FeatureError("invalid_validity")
        try:
            from zoneinfo import ZoneInfo

            ZoneInfo(out["timezone"])
        except Exception:  # noqa: BLE001
            raise FeatureError("invalid_fields") from None
    elif feature in ("door_automations", "live_media", "live_validation"):
        absolute_time(out["expiry"])
    return out


def execution_end(feature: str, params: dict[str, Any]) -> datetime:
    """The deadline the draft itself carries (door windows: `end`; automations / media / validation: `expiry`)."""
    return absolute_time(params["end"] if feature == "door_windows" else params["expiry"])


def human_actor(user_id: str) -> dict[str, Any]:
    if not _ref(user_id):
        raise FeatureError("invalid_fields")
    return {"kind": "human", "user_id": user_id}


def automation_actor(*, automation_id: str, run_id: str, trigger_id: str, creator_user_id: str, approver_user_id: str, grant_revision: int) -> dict[str, Any]:
    values = {"automation_id": automation_id, "run_id": run_id, "trigger_id": trigger_id, "creator_user_id": creator_user_id,
              "approver_user_id": approver_user_id}
    if not all(_ref(v) for v in values.values()) or not wp.is_pos_int(grant_revision):
        raise FeatureError("invalid_fields")
    return {"kind": "automation", **values, "grant_revision": grant_revision}


def build_request(*, feature: str, actor: dict[str, Any], authority_ref: str, authority_revision: int, scope_ref: str, parameter_reference: str,
                  params: dict[str, Any], now: datetime, execution_expires_at: datetime | None = None, ttl_s: int = DEFAULT_TTL_S,
                  request_id: str | None = None, operation_id: str | None = None, operation_binding_ref: str | None = None) -> dict[str, Any]:
    """The closed request body WisKey's `FeatureRequest.parse` accepts. Nothing is sent. The actor, authority revision, scope and
    parameter references are Arx's own records; `params` is the draft (WisKey re-normalises and compares it)."""
    if now.tzinfo is None or now.utcoffset() is None:
        raise FeatureError("invalid_fields")
    if not 1 <= ttl_s <= MAX_TTL_S:
        raise FeatureError("invalid_fields")
    clean = validate_params(feature, params)
    if not (_ref(authority_ref) and _ref(scope_ref) and _ref(parameter_reference) and wp.is_pos_int(authority_revision)):
        raise FeatureError("invalid_fields")
    kind = actor.get("kind") if isinstance(actor, dict) else None
    if kind == "human":
        if set(actor) != {"kind", "user_id"} or not _ref(actor["user_id"]):
            raise FeatureError("invalid_fields")
    elif kind == "automation":
        if set(actor) != AUTOMATION_ACTOR_FIELDS or not all(_ref(actor[k]) for k in AUTOMATION_ACTOR_FIELDS - {"kind", "grant_revision"}):
            raise FeatureError("invalid_fields")
        if actor["grant_revision"] != authority_revision:
            raise FeatureError("binding_denied")
    else:
        raise FeatureError("Unauthorized")
    # WisKey FeatureRequest.parse: door automations need an automation actor; an automation actor is allowed only for door automations and for the
    # emergency FIRE trigger (EMERGENCY_EVENT_V2.md) - never for the other features, and never a human for door automations.
    if (feature == "door_automations") and kind != "automation":
        raise FeatureError("Unauthorized")
    if kind == "automation" and feature not in ("door_automations", "emergency_buttons"):
        raise FeatureError("Unauthorized")
    if feature in ("door_windows", "door_automations", "live_media", "live_validation"):
        end = execution_end(feature, clean)
        if execution_expires_at is not None and absolute_time(_utc(execution_expires_at)) != end:
            raise FeatureError("binding_denied")
    else:
        if execution_expires_at is None:
            raise FeatureError("invalid_validity")
        end = absolute_time(_utc(execution_expires_at))
    now_utc = now.astimezone(timezone.utc)
    if end <= now_utc:
        raise FeatureError("binding_denied")
    rid = request_id or str(uuid.uuid4())
    if not UUID_RE.fullmatch(rid):
        raise FeatureError("invalid_fields")
    body = {
        "contract_version": CONTRACT, "feature": feature, "request_id": rid, "operation_id": operation_id or str(uuid.uuid4()),
        "operation_binding_ref": operation_binding_ref or str(uuid.uuid4()), "actor": dict(actor), "authority_ref": authority_ref,
        "authority_revision": authority_revision, "scope_ref": scope_ref, "parameter_reference": parameter_reference,
        "issued_at": _utc(now_utc), "request_expires_at": _utc(now_utc + timedelta(seconds=ttl_s)), "execution_expires_at": _utc(end), "params": clean}
    if set(body) != FEATURE_FIELDS or not (_ref(body["operation_id"]) and _ref(body["operation_binding_ref"])):
        raise FeatureError("invalid_fields")
    return body


# ---------------------------------------------------------------- the relay map (explicit operator facts)

@dataclass(frozen=True)
class RelayRow:
    station_id: str
    api_relay: int
    physical_relay: int
    revision: int


def set_relay_map(conn: sqlite3.Connection, *, station_id: str, api_relay: int, physical_relay: int, confirmed_by: str, expected_revision: int,
                  active: bool = True, now: str | None = None) -> int:
    """Compare-and-set one mapping row (expected_revision 0 = create). Explicit operator action only; returns the new revision."""
    if not (_ref(station_id) and api_relay in (1, 2) and physical_relay in (1, 2) and _ref(confirmed_by)
            and isinstance(expected_revision, int) and not isinstance(expected_revision, bool) and 0 <= expected_revision < wp.MAX_JSON_INT):
        raise FeatureError("invalid_fields")
    at = now or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    row = conn.execute("SELECT revision FROM wiskey_relay_map WHERE station_id=? AND api_relay=?", (station_id, api_relay)).fetchone()
    current = row[0] if row else 0
    if current != expected_revision:
        raise FeatureError("revision_conflict")
    new = current + 1
    if row is None:
        conn.execute("INSERT INTO wiskey_relay_map (station_id, api_relay, physical_relay, revision, active, confirmed_by, updated_at) VALUES (?,?,?,?,?,?,?)",
                     (station_id, api_relay, physical_relay, new, 1 if active else 0, confirmed_by, at))
    else:
        conn.execute("UPDATE wiskey_relay_map SET physical_relay=?, revision=?, active=?, confirmed_by=?, updated_at=? WHERE station_id=? AND api_relay=?",
                     (physical_relay, new, 1 if active else 0, confirmed_by, at, station_id, api_relay))
    return new


def relay_row(conn: sqlite3.Connection, station_id: str, api_relay: int) -> RelayRow | None:
    r = conn.execute("SELECT physical_relay, revision, active FROM wiskey_relay_map WHERE station_id=? AND api_relay=?", (station_id, api_relay)).fetchone()
    return RelayRow(station_id, api_relay, r[0], r[1]) if r and r[2] == 1 else None


def relay_row_for_door(conn: sqlite3.Connection, station_id: str, physical_relay: int) -> RelayRow | None:
    """The active map row of an Arx DOOR. Arx keys a door by WisKey's `physical_index` (door_windows._sync_doors); WisKey binds a request by
    `params.relay == grant.physical_relay` and a grant by its `api_relay` (WISKEY-RC5-2310). None when no row, or more than one active row,
    names that physical relay (WisKey refuses a duplicate physical relay in a snapshot as well)."""
    rows = conn.execute("SELECT api_relay, revision FROM wiskey_relay_map WHERE station_id=? AND physical_relay=? AND active=1",
                        (station_id, physical_relay)).fetchall()
    return RelayRow(station_id, rows[0][0], physical_relay, rows[0][1]) if len(rows) == 1 else None


# ---------------------------------------------------------------- the current policy (Arx RBAC is the only authority)

@dataclass(frozen=True)
class StationGrant:
    station_id: str
    api_relay: int
    physical_relay: int
    mapping_revision: int


@dataclass(frozen=True)
class PolicyDocument:
    feature: str
    complete: bool
    permissions: frozenset[str]
    stations: tuple[StationGrant, ...]
    why_incomplete: tuple[str, ...] = ()

    def as_wire(self, source_epoch: str) -> dict[str, Any]:
        """The data a verified bridge answers with; `source_epoch` is Arx's opaque epoch of this evaluation (e.g. an authority revision)."""
        return {"source_epoch": source_epoch, "complete": self.complete, "permissions": sorted(self.permissions),
                "stations": [{"station_id": s.station_id, "api_relay": s.api_relay, "physical_relay": s.physical_relay, "mapping_revision": s.mapping_revision}
                             for s in self.stations]}


def _held_on_all(auth: Authority, arx_permissions: tuple[str, ...], stations: list[str]) -> bool:
    return bool(stations) and all(any(auth.station(p, sid) for p in arx_permissions) for sid in stations)


def resolve_policy(conn: sqlite3.Connection, principals: Iterable[Principal], *, feature: str, targets: Iterable[tuple[str, int]]) -> PolicyDocument:
    """The CURRENT policy for `feature` over the explicit (station, api relay) `targets`, judged for EVERY principal in `principals`
    (the human actor; for an automation both its creator and its approver). A permission is offered only when each principal holds one
    of its Arx permissions on every station of the scope (station chain, deny wins). A station without a confirmed, active relay map
    makes the document incomplete. Nothing is cached and nothing comes from the request."""
    if feature not in REQUIREMENTS:
        raise FeatureError("unknown_feature")
    why: list[str] = []
    wanted = sorted({(sid, rl) for sid, rl in targets})
    if feature in STATION_SCOPED and not wanted:
        why.append("no_targets")
    grants: list[StationGrant] = []
    for sid, rl in wanted:
        row = relay_row(conn, sid, rl)
        if row is None:
            why.append(f"relay_map_missing:{sid}:{rl}")
            continue
        grants.append(StationGrant(sid, rl, row.physical_relay, row.revision))
    auths = [Authority(conn, p) for p in principals]
    if not auths:
        why.append("no_principal")
    station_ids = sorted({g.station_id for g in grants})
    held: set[str] = set()
    for wiskey_perm in PERMISSIONS_OF_FEATURE[feature]:
        arx = ARX_PERMISSION_OF[wiskey_perm]
        if feature in STATION_SCOPED:
            ok = bool(auths) and all(_held_on_all(a, arx, station_ids) for a in auths)
        else:
            ok = bool(auths) and all(any(a.installation(p).allowed for p in arx) for a in auths)
        if ok:
            held.add(wiskey_perm)
    if not held:
        why.append("no_permission")
    return PolicyDocument(feature, complete=not why, permissions=frozenset(held), stations=tuple(grants), why_incomplete=tuple(why))


# ---------------------------------------------------------------- the durable attempt (no replay)

def admit_request(conn: sqlite3.Connection, body: dict[str, Any], *, now: str | None = None) -> None:
    """Store the intent of a built request BEFORE any I/O. The same request id / operation id is refused (`duplicate`): one attempt."""
    if set(body) != FEATURE_FIELDS:
        raise FeatureError("invalid_fields")
    actor = body["actor"]
    actor_ref = actor["user_id"] if actor["kind"] == "human" else actor["automation_id"]
    try:
        conn.execute(
            "INSERT INTO wiskey_feature_intents (request_id, operation_id, operation_binding_ref, feature, actor_kind, actor_ref, authority_ref, "
            "authority_revision, scope_ref, parameter_reference, issued_at, request_expires_at, execution_expires_at, state, created_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'intent',?)",
            (body["request_id"], body["operation_id"], body["operation_binding_ref"], body["feature"], actor["kind"], actor_ref, body["authority_ref"],
             body["authority_revision"], body["scope_ref"], body["parameter_reference"], body["issued_at"], body["request_expires_at"],
             body["execution_expires_at"], now or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")))
    except sqlite3.IntegrityError:
        raise FeatureError("duplicate") from None


def intent_state(conn: sqlite3.Connection, request_id: str) -> str | None:
    r = conn.execute("SELECT state FROM wiskey_feature_intents WHERE request_id=?", (request_id,)).fetchone()
    return r[0] if r else None


def mark_feature_sent(conn: sqlite3.Connection, request_id: str) -> None:
    if conn.execute("UPDATE wiskey_feature_intents SET state='sent' WHERE request_id=? AND state='intent'", (request_id,)).rowcount != 1:
        raise FeatureError("not_sendable")


def settle_feature(conn: sqlite3.Connection, request_id: str, state: str, code: str | None = None, now: str | None = None) -> bool:
    """accepted / refused only from a verified answer; `unknown` for a missing / invalid / late one. A settled intent never moves again."""
    if state not in ("accepted", "refused", "unknown"):
        raise FeatureError("invalid_state")
    return conn.execute("UPDATE wiskey_feature_intents SET state=?, code=?, settled_at=? WHERE request_id=? AND state IN ('intent','sent','unknown')",
                        (state, code if (code is None or _ref(code)) else "unknown", now or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                         request_id)).rowcount == 1


class LiveFeatureTransport:
    """No delivery path exists: the envelope, route and the verified bridge's service identity are a joint pin with the Mac."""

    def send(self, body: dict[str, Any]) -> Any:  # noqa: ARG002
        raise wp.PeerSeamError("not_built")


# ---------------------------------------------------------------- registry facts and the honest status

def registry(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    rows = conn.execute("SELECT feature, enabled, peer_binding_ref, peer_binding_revision, host_registered, host_checked_at, host_code FROM wiskey_feature_registry").fetchall()
    return {r[0]: {"enabled": bool(r[1]), "peer_binding_ref": r[2], "peer_binding_revision": r[3], "host_registered": bool(r[4]),
                   "host_checked_at": r[5], "host_code": r[6]} for r in rows}


def set_feature_enabled(conn: sqlite3.Connection, feature: str, enabled: bool, now: str | None = None) -> None:
    """The switch only. It registers nothing at the host and proves nothing: `status` still reports every blocker."""
    if feature not in REQUIREMENTS:
        raise FeatureError("unknown_feature")
    conn.execute("UPDATE wiskey_feature_registry SET enabled=?, updated_at=? WHERE feature=?",
                 (1 if enabled else 0, now or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), feature))


def record_host_registration(conn: sqlite3.Connection, feature: str, *, peer: wp.VerifiedPeerRef, verified: bool, code: str, now: str | None = None) -> None:
    """Record what a VERIFIED answer of the WisKey host said about the registration of this feature's adapter (never from a flag)."""
    if feature not in REQUIREMENTS:
        raise FeatureError("unknown_feature")
    wp.as_peer_binding(peer)
    conn.execute("UPDATE wiskey_feature_registry SET peer_binding_ref=?, peer_binding_revision=?, host_registered=?, host_checked_at=?, host_code=?, updated_at=? "
                 "WHERE feature=?", (peer.peer_binding_ref, peer.peer_binding_revision, 1 if verified else 0, now or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                                    code if _ref(code) else "unknown", now or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), feature))


def status(conn: sqlite3.Connection, *, transport_built: bool = False) -> dict[str, dict[str, Any]]:
    """Per feature: the facts and every blocker, in plain codes. `active` is True only when enabled AND the host registration was
    verified AND a transport exists AND at least one active relay-map row exists for the station-scoped features."""
    reg = registry(conn)
    mapped = conn.execute("SELECT COUNT(*) FROM wiskey_relay_map WHERE active=1").fetchone()[0]
    out: dict[str, dict[str, Any]] = {}
    for feature in FEATURES:
        r = reg.get(feature, {"enabled": False, "host_registered": False})
        blockers = []
        if not transport_built:
            blockers.append(TRANSPORT_BLOCK)
        if not r["host_registered"]:
            blockers.append("host_registration_unverified")
        if feature in STATION_SCOPED and mapped == 0:
            blockers.append("relay_map_empty")
        if not r["enabled"]:
            blockers.append("switch_off")
        out[feature] = {"enabled": r["enabled"], "host_registered": r["host_registered"], "relay_map_rows": mapped if feature in STATION_SCOPED else None,
                        "blockers": blockers, "active": not blockers}
    return out
