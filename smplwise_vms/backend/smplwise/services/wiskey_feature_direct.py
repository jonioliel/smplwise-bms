"""WKCAP-295 item 11: the six WisKey feature adapters on the direct transport (wiskey-arx-feature-execution.v1; DIRECT_FEATURE_MEDIA_V1.md;
FEATURE_COMPLETION_READ_V1.md). Real code against the `WiskeyDirectPort` fake; nothing here has run against a WisKey, a station or a door.

Layers (each already existed in Arx, none is replaced)
- `wiskey_feature_exec` : the closed request, the CURRENT policy from Arx RBAC (`Authority`, deny wins) and the relay map, the durable no-replay intent table.
- this module            : the POLICY SNAPSHOT (WisKey `arx_policy_snapshot.py`, closed 18 fields) built from that policy, the five signed commands
  `features/status | start | result | cancel | prepare_media` through the port, the closed readers of their answers, and the direct media ingress request.

Rules this module enforces
- The intent is stored and committed BEFORE the first byte leaves (`fx.admit_request`, then `mark_feature_sent`); a request id / operation id is never admitted twice.
- Nothing is resent. A reply that is missing, late or fails the transport's MAC is UNKNOWN; a refusal before the command left is `not_sent`; only a closed host error is `refused`.
- A COMPLETION READ (`features/result`) is a fresh, separately signed command: it carries ONLY `operation_ref`, never a request or a snapshot, never touches the intent row's
  execution deadline and never renews an execution permission. It stays possible after the execution lease ended; if the host refuses it (policy revoked, source swapped,
  another connection) the refusal is returned as a refusal of the READ - it settles nothing and proves nothing about the effect.
- `features/cancel` answers `cleanup_joined`: the owned task was joined. That is NOT `no_effect`: `CancelResult.no_effect` is always False.
- `finished` describes the native receipt, never a physical observation (`physical_confirmed` is always False).
- Direct media: `features/prepare_media` returns private tickets under `/api/hikvision_intercom/arx_bridge/v1/media/{ticket}`. The media WebSocket is authenticated ONLY by the
  `X-WisKey-Bridge` header (a pairing-signed `features/media_ingress_v1` command over exactly ticket, preparation_ref, connection_ref) on the SAME connection the ticket was issued
  on. No bearer token, no HA user, no query string; a ticket is used once. The port signs the header; this module never sees a key.
- Door automations, and emergency FIRE, carry the original automation actor (automation_id, run_id, trigger_id, creator, approver, grant_revision); a fabricated user is never
  put in their place."""
from __future__ import annotations

import hashlib
import re
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Mapping

from ..rbac import Principal
from . import wiskey_feature_exec as fx
from . import wiskey_peer as wp
from .wiskey_capture_port import PortError, PortIdentity, WiskeyDirectPort

SNAPSHOT_VERSION = 1
MAX_POLICY_S = 24 * 3600
POLICY_TAIL_S = 60  # the snapshot outlives the execution deadline by this much (WisKey: execution_end <= expires_at)
START_TIMEOUT_S = 8.0
READ_TIMEOUT_S = 6.0
CANCEL_TIMEOUT_S = 8.0
MEDIA_PATH_PREFIX = "/api/hikvision_intercom/arx_bridge/v1/media/"
LEGACY_MEDIA_PATH_PREFIX = "/api/hikvision_intercom/features/media/"  # HA-authenticated; never used on the direct transport
MEDIA_HEADER = "X-WisKey-Bridge"
MAX_HEADER_BYTES = 16384
TICKET_RE = re.compile(r"^[0-9a-f]{32,128}$")
COMMANDS = ("features/status", "features/start", "features/result", "features/cancel", "features/prepare_media")


class FeatureWireError(Exception):
    """`outcome`: not_sent | refused | unknown (the same words as `PortError`)."""

    def __init__(self, code: str, outcome: str = "refused") -> None:
        super().__init__(code)
        self.code = str(code)[:64]
        self.outcome = outcome


def _ref(value: Any) -> bool:
    return wp.is_ref(value)


def _utc(value: datetime) -> str:
    v = value.astimezone(timezone.utc)
    return v.strftime("%Y-%m-%dT%H:%M:%S.%fZ") if v.microsecond else v.strftime("%Y-%m-%dT%H:%M:%SZ")


def _gid(prefix: str, *parts: Any) -> str:
    return prefix + hashlib.sha256("\x1f".join(str(p) for p in parts).encode("utf-8")).hexdigest()[:40]


# ---------------------------------------------------------------- the policy snapshot (WisKey access/arx_policy_snapshot.py)

@dataclass(frozen=True)
class RowGrantInput:
    """One people/CSV row grant (WisKey `RowGrant`). The SOURCE of these values is Arx's bulk-people preview (source line, person, revision, origin reference, change
    digest); this branch has no module that produces them - the caller supplies them (see the change note, "missing sources")."""

    source_line: int
    user_id: str
    revision: int | None
    origin_ref: str
    change_digest: str


def build_policy_snapshot(*, identity: PortIdentity, request: Mapping[str, Any], doc: fx.PolicyDocument, source_epoch: str, now: datetime,
                          actor_session_active: bool, private_input: Mapping[str, Any] | None = None,
                          rows: Iterable[RowGrantInput] = ()) -> dict[str, Any]:
    """The closed snapshot for `request`. Refused (FeatureWireError, nothing sent) when the current policy is incomplete/empty or its facts cannot satisfy WisKey's checks
    (repository / owner / actor / authority / scope must equal the request's; execution must not outlive the policy; at most 24 h)."""
    if not doc.complete or not doc.permissions:
        raise FeatureWireError("policy_incomplete", "not_sent")
    if request.get("feature") != doc.feature or not _ref(source_epoch):
        raise FeatureWireError("policy_binding_denied", "not_sent")
    actor = request["actor"]
    if actor.get("kind") == "human" and actor_session_active is not True:
        raise FeatureWireError("policy_binding_denied", "not_sent")
    end = fx.absolute_time(request["execution_expires_at"])
    issued = now.astimezone(timezone.utc)
    expires = min(end + timedelta(seconds=POLICY_TAIL_S), issued + timedelta(seconds=MAX_POLICY_S))
    if expires < end or issued >= expires:
        raise FeatureWireError("policy_expired", "not_sent")
    stations = [{"grant_id": _gid("stn-", s.station_id, s.api_relay), "station_id": s.station_id, "api_relay": s.api_relay,
                 "physical_relay": s.physical_relay, "mapping_revision": s.mapping_revision} for s in doc.stations]
    row_items: list[dict[str, Any]] = []
    for r in rows:
        if not (type(r.source_line) is int and r.source_line >= 1 and _ref(r.user_id) and _ref(r.origin_ref) and _ref(r.change_digest)
                and (r.revision is None or wp.is_pos_int(r.revision))):
            raise FeatureWireError("invalid_row_grant", "not_sent")
        row_items.append({"grant_id": _gid("row-", r.source_line, r.change_digest), "source_line": r.source_line, "user_id": r.user_id,
                          "revision": r.revision, "origin_ref": r.origin_ref, "change_digest": r.change_digest})
    snapshot = {
        "schema_version": SNAPSHOT_VERSION, "repository_id": identity.repository_id,
        "bridge_owner": {"entry_id": identity.entry_id, "query_owner_id": identity.query_owner_id},
        "source_epoch": source_epoch, "authority_ref": request["authority_ref"], "authority_revision": request["authority_revision"],
        "scope_ref": request["scope_ref"], "actor": dict(actor), "actor_session_active": actor_session_active is True,
        "issued_at": _utc(issued), "expires_at": _utc(expires), "active": True, "complete": True,
        "permissions": sorted(doc.permissions), "grant_ids": [s["grant_id"] for s in stations] + [r["grant_id"] for r in row_items],
        "stations": stations, "rows": row_items, "private_input": dict(private_input) if private_input is not None else None}
    if len({g for g in snapshot["grant_ids"]}) != len(snapshot["grant_ids"]):
        raise FeatureWireError("invalid_policy_snapshot", "not_sent")
    return snapshot


# ---------------------------------------------------------------- the closed readers of the host's answers

_ACK_KEYS = {"schema_version", "operation_ref", "state", "execution_result", "replay_available"}
_RESULT_KEYS = {"running": {"schema_version", "operation_ref", "state"},
                "cancelled": {"schema_version", "operation_ref", "state", "replay_available"},
                "unknown": {"schema_version", "operation_ref", "state", "replay_available"},
                "finished": {"schema_version", "operation_ref", "state", "receipt", "replay_available"}}
_CANCEL_KEYS = {"schema_version", "operation_ref", "state", "replay_available"}
_MEDIA_KEYS = {"schema_version", "state", "preparation_ref", "operation_ref", "expires_at", "ingress", "replay_available"}


@dataclass(frozen=True)
class StartOutcome:
    state: str  # admitted | refused | not_sent | unknown
    operation_ref: str | None = None
    code: str | None = None


@dataclass(frozen=True)
class FeatureResult:
    state: str  # running | finished | cancelled | unknown
    operation_ref: str
    receipt: Mapping[str, Any] | None = None
    physical_confirmed: bool = False  # `finished` is the native receipt, never a physical observation
    replay_available: bool = False


@dataclass(frozen=True)
class CancelResult:
    operation_ref: str
    cleanup_joined: bool
    no_effect: bool = False  # cleanup_joined is NOT proof of no_effect: always False here


@dataclass(frozen=True)
class MediaStep:
    step_id: str
    ticket: str
    path: str


@dataclass(frozen=True)
class MediaPreparation:
    preparation_ref: str
    operation_ref: str | None
    state: str
    expires_at: str
    steps: tuple[MediaStep, ...]


@dataclass(frozen=True)
class MediaIngressRequest:
    path: str
    headers: Mapping[str, str] = field(repr=False)


def read_start_ack(raw: Any) -> str:
    """The operation_ref of a closed `admitted` ack, else FeatureWireError(unknown): an answer that is not the closed shape is not an admission."""
    if (not isinstance(raw, Mapping) or set(raw) != _ACK_KEYS or raw.get("schema_version") != 1 or type(raw.get("schema_version")) is not int
            or raw.get("state") != "admitted" or raw.get("execution_result") != "pending" or raw.get("replay_available") is not False
            or not _ref(raw.get("operation_ref"))):
        raise FeatureWireError("invalid_response", "unknown")
    return raw["operation_ref"]


def read_result(raw: Any, operation_ref: str) -> FeatureResult:
    state = raw.get("state") if isinstance(raw, Mapping) else None
    keys = _RESULT_KEYS.get(state) if isinstance(state, str) else None
    if (keys is None or set(raw) != keys or raw.get("schema_version") != 1 or type(raw.get("schema_version")) is not int or raw.get("operation_ref") != operation_ref
            or ("replay_available" in keys and raw.get("replay_available") is not False)
            or (state == "finished" and not isinstance(raw.get("receipt"), Mapping))):
        raise FeatureWireError("invalid_response", "unknown")
    return FeatureResult(state, operation_ref, raw.get("receipt") if state == "finished" else None)


def read_cancel(raw: Any, operation_ref: str) -> CancelResult:
    if (not isinstance(raw, Mapping) or set(raw) != _CANCEL_KEYS or raw.get("schema_version") != 1 or raw.get("state") != "cleanup_joined"
            or raw.get("operation_ref") != operation_ref or raw.get("replay_available") is not False):
        raise FeatureWireError("invalid_response", "unknown")
    return CancelResult(operation_ref, cleanup_joined=True, no_effect=False)


def media_path(url: Any) -> tuple[str, str]:
    """(path, ticket) of a DIRECT ingress url, else FeatureWireError. The legacy HA path, a query string, a host or a fragment are refused."""
    if (type(url) is not str or "?" in url or "#" in url or not url.startswith(MEDIA_PATH_PREFIX) or url.startswith(LEGACY_MEDIA_PATH_PREFIX)):
        raise FeatureWireError("invalid_media_ingress", "unknown")
    ticket = url[len(MEDIA_PATH_PREFIX):]
    if not TICKET_RE.fullmatch(ticket):
        raise FeatureWireError("invalid_media_ingress", "unknown")
    return url, ticket


def read_media(raw: Any) -> MediaPreparation:
    if (not isinstance(raw, Mapping) or set(raw) != _MEDIA_KEYS or raw.get("schema_version") != 1 or raw.get("state") not in ("prepared", "active")
            or raw.get("replay_available") is not False or not _ref(raw.get("preparation_ref")) or not isinstance(raw.get("ingress"), list)
            or not isinstance(raw.get("expires_at"), str)):
        raise FeatureWireError("invalid_response", "unknown")
    steps = []
    for item in raw["ingress"]:
        if not isinstance(item, Mapping) or set(item) != {"step_id", "url"} or not _ref(item["step_id"]):
            raise FeatureWireError("invalid_response", "unknown")
        path, ticket = media_path(item["url"])
        steps.append(MediaStep(item["step_id"], ticket, path))
    if len({s.ticket for s in steps}) != len(steps):
        raise FeatureWireError("invalid_response", "unknown")
    op = raw.get("operation_ref")
    return MediaPreparation(raw["preparation_ref"], op if _ref(op) else None, raw["state"], raw["expires_at"], tuple(steps))


def _rpc_timeout(maximum):
    from . import wiskey_call_budget as budget
    return budget.remaining(maximum) if budget.active() else maximum


# ---------------------------------------------------------------- the client

def _commit(conn: sqlite3.Connection) -> None:
    """Commit by hand the way Arx does it (db.commit_now): the write lock is handed on, so no network call below ever runs inside a write transaction."""
    from ..db import commit_now

    commit_now(conn, keep_reading=False)


class DirectFeatureClient:
    """The five feature commands over a `WiskeyDirectPort`. Stateless apart from the set of media tickets this process already presented."""

    def __init__(self, port: WiskeyDirectPort) -> None:
        self.port = port
        self._used_tickets: set[str] = set()

    # -- start (the durable intent first) ---------------------------------------------------------------------------------------------
    def start(self, conn: sqlite3.Connection, body: dict[str, Any], snapshot: dict[str, Any], *, subscription: int | None = None) -> StartOutcome:
        fx.admit_request(conn, body)  # raises duplicate: one attempt per request id and per operation id
        _commit(conn)  # committed BEFORE any I/O
        fx.mark_feature_sent(conn, body["request_id"])
        _commit(conn)
        params: dict[str, Any] = {"request": body, "policy_snapshot": snapshot}
        if subscription is not None:
            if type(subscription) is not int or subscription < 1:
                fx.settle_feature(conn, body["request_id"], "refused", "invalid_fields")
                raise FeatureWireError("invalid_fields", "not_sent")
            params["subscription"] = subscription
        return self._finish_start(conn, body["request_id"], "features/start", params)

    def _finish_start(self, conn: sqlite3.Connection, request_id: str, command: str, params: dict[str, Any]) -> StartOutcome:
        try:
            raw = self.port.call(command, params, timeout_s=_rpc_timeout(START_TIMEOUT_S))
        except PortError as exc:
            state = {"not_sent": "refused", "refused": "refused"}.get(exc.outcome, "unknown")
            if exc.outcome == "refused" and params.get("request", {}).get("feature") == "emergency_buttons":
                # Original Native may have started an operation before its
                # final auth/current-host recheck rejects publication. No
                # commit-stage proof exists in the old signed error envelope.
                state = "unknown"
            fx.settle_feature(conn, request_id, state, "not_sent" if exc.outcome == "not_sent" else exc.code)
            _commit(conn)
            return StartOutcome("not_sent" if exc.outcome == "not_sent" else state, None, exc.code)
        try:
            op = read_start_ack(raw)
        except FeatureWireError as exc:
            fx.settle_feature(conn, request_id, "unknown", exc.code)
            _commit(conn)
            return StartOutcome("unknown", None, exc.code)
        record_operation(conn, request_id, op)  # the intent stays `sent` until a result settles it; the operation_ref is its handle
        _commit(conn)
        return StartOutcome("admitted", op)

    # -- completion read (never renews anything) ------------------------------------------------------------------------------------
    def result(self, operation_ref: str) -> FeatureResult:
        if not _ref(operation_ref):
            raise FeatureWireError("invalid_fields", "not_sent")
        try:
            raw = self.port.call("features/result", {"operation_ref": operation_ref}, timeout_s=_rpc_timeout(READ_TIMEOUT_S))
        except PortError as exc:
            raise FeatureWireError(exc.code, exc.outcome) from None
        return read_result(raw, operation_ref)

    def event_status(self, event_ref, station_id, door, mapping_revision):
        try:
            raw = self.port.call("features/emergency_event_status_v1", {"event_ref": event_ref,
                "station_id": station_id, "door": door, "mapping_revision": mapping_revision}, timeout_s=_rpc_timeout(READ_TIMEOUT_S))
        except PortError as exc:
            raise FeatureWireError(exc.code, exc.outcome) from None
        return read_event_status(raw, event_ref)

    def cancel(self, operation_ref: str) -> CancelResult:
        if not _ref(operation_ref):
            raise FeatureWireError("invalid_fields", "not_sent")
        try:
            raw = self.port.call("features/cancel", {"operation_ref": operation_ref}, timeout_s=_rpc_timeout(CANCEL_TIMEOUT_S))
        except PortError as exc:
            raise FeatureWireError(exc.code, exc.outcome) from None
        return read_cancel(raw, operation_ref)

    def status(self) -> Mapping[str, Any]:
        try:
            raw = self.port.call("features/status", {}, timeout_s=_rpc_timeout(READ_TIMEOUT_S))
        except PortError as exc:
            raise FeatureWireError(exc.code, exc.outcome) from None
        if not isinstance(raw, Mapping):
            raise FeatureWireError("invalid_response", "unknown")
        return raw

    # -- media -----------------------------------------------------------------------------------------------------------------------
    def prepare_media(self, conn: sqlite3.Connection, body: dict[str, Any], snapshot: dict[str, Any], *, subscription: int | None = None) -> MediaPreparation:
        if body.get("feature") != "live_media":
            raise FeatureWireError("invalid_fields", "not_sent")
        fx.admit_request(conn, body)
        _commit(conn)
        fx.mark_feature_sent(conn, body["request_id"])
        _commit(conn)
        params: dict[str, Any] = {"request": body, "policy_snapshot": snapshot}
        if subscription is not None:
            params["subscription"] = subscription
        try:
            raw = self.port.call("features/prepare_media", params, timeout_s=_rpc_timeout(START_TIMEOUT_S))
        except PortError as exc:
            fx.settle_feature(conn, body["request_id"], "refused" if exc.outcome != "unknown" else "unknown", "not_sent" if exc.outcome == "not_sent" else exc.code)
            _commit(conn)
            raise FeatureWireError(exc.code, exc.outcome) from None
        try:
            prep = read_media(raw)
        except FeatureWireError as exc:
            fx.settle_feature(conn, body["request_id"], "unknown", exc.code)
            _commit(conn)
            raise
        if prep.operation_ref:
            record_operation(conn, body["request_id"], prep.operation_ref)
        _commit(conn)
        return prep

    def media_ingress_request(self, prep: MediaPreparation, step_id: str) -> MediaIngressRequest:
        """The request of ONE ingress ticket: the path and the `X-WisKey-Bridge` header, nothing else. A ticket is presented once."""
        step = next((s for s in prep.steps if s.step_id == step_id), None)
        if step is None:
            raise FeatureWireError("unknown_step", "not_sent")
        if step.ticket in self._used_tickets:
            raise FeatureWireError("ticket_consumed", "not_sent")
        try:
            header = self.port.media_ingress_header(ticket=step.ticket, preparation_ref=prep.preparation_ref)
        except PortError as exc:
            raise FeatureWireError(exc.code, exc.outcome) from None
        if type(header) is not str or not header or len(header.encode("utf-8")) > MAX_HEADER_BYTES:
            raise FeatureWireError("invalid_media_header", "not_sent")
        self._used_tickets.add(step.ticket)
        return MediaIngressRequest(step.path, {MEDIA_HEADER: header})

    def open_media(self, prep: MediaPreparation, step_id: str, *, timeout_s: float = 10.0) -> Any:
        req = self.media_ingress_request(prep, step_id)
        try:
            return self.port.open_media(path=req.path, headers=req.headers, timeout_s=timeout_s)
        except PortError as exc:
            raise FeatureWireError(exc.code, exc.outcome) from None


def record_operation(conn: sqlite3.Connection, request_id: str, operation_ref: str) -> None:
    """Keep the host's handle on the intent row (column `code`, `op:<ref>`) while the intent is still open (`sent`)."""
    conn.execute("UPDATE wiskey_feature_intents SET code=? WHERE request_id=? AND state='sent'", ("op:" + operation_ref, request_id))


def operation_of(conn: sqlite3.Connection, request_id: str) -> str | None:
    r = conn.execute("SELECT code FROM wiskey_feature_intents WHERE request_id=?", (request_id,)).fetchone()
    return r[0][3:] if r and isinstance(r[0], str) and r[0].startswith("op:") else None


# ---------------------------------------------------------------- the six adapters (what differs per feature)

@dataclass(frozen=True)
class FeatureSpec:
    feature: str
    actors: tuple[str, ...]  # allowed actor kinds
    needs_targets: bool
    needs_rows: bool = False
    media: bool = False


SPECS: dict[str, FeatureSpec] = {
    "door_windows": FeatureSpec("door_windows", ("human",), True),
    "emergency_buttons": FeatureSpec("emergency_buttons", ("human", "automation"), True),  # automation = the fire trigger (EMERGENCY_EVENT_V2.md)
    "door_automations": FeatureSpec("door_automations", ("automation",), True),
    "people_csv": FeatureSpec("people_csv", ("human",), False, needs_rows=True),
    "live_media": FeatureSpec("live_media", ("human",), True, media=True),
    "live_validation": FeatureSpec("live_validation", ("human",), False),
}
assert set(SPECS) == set(fx.FEATURES)


def _judged_is_actor(actor: Mapping[str, Any], principals: list[Principal]) -> bool:
    """W031-295: the Arx principals whose permissions bind the request are exactly the actor the request names - the human alone; for an
    automation its creator and its approver (the same user may be both). Never a different or an extra principal."""
    ids = [getattr(p, "user_id", None) for p in principals]
    if not ids or any(not isinstance(i, str) or not i for i in ids):
        return False
    kind = actor.get("kind")
    if kind == "human":
        return set(ids) == {actor.get("user_id")}
    if kind == "automation":
        return set(ids) == {actor.get("creator_user_id"), actor.get("approver_user_id")}
    return False


class FeatureAdapters:
    """Builds the request + current policy + snapshot of any of the six features from Arx's own records and sends it through `DirectFeatureClient`.

    `principals_of(actor)` returns the Arx `Principal`s whose permissions bind the request: the human; for an automation BOTH its creator and its approver. It is the caller's
    (Arx's own session / automation records), never derived from the wire."""

    def __init__(self, client: DirectFeatureClient, port: WiskeyDirectPort) -> None:
        self.client = client
        self.port = port

    def prepare(self, conn: sqlite3.Connection, *, feature: str, actor: dict[str, Any], principals: Iterable[Principal], authority_ref: str, authority_revision: int,
                scope_ref: str, parameter_reference: str, params: dict[str, Any], now: datetime, source_epoch: str, actor_session_active: bool,
                targets: Iterable[tuple[str, int]] | None = None, rows: Iterable[RowGrantInput] = (), private_input: Mapping[str, Any] | None = None,
                execution_expires_at: datetime | None = None, ttl_s: int = fx.DEFAULT_TTL_S, request_id: str | None = None,
                operation_id: str | None = None, allow_empty_rows: bool = False) -> tuple[dict[str, Any], dict[str, Any]]:
        spec = SPECS.get(feature)
        if spec is None:
            raise FeatureWireError("unknown_feature", "not_sent")
        if actor.get("kind") not in spec.actors:
            raise FeatureWireError("Unauthorized", "not_sent")
        principals = list(principals)
        if not _judged_is_actor(actor, principals):
            raise FeatureWireError("Unauthorized", "not_sent")  # W031-295: the policy is judged for exactly the actor the wire names
        if spec.needs_targets:
            tgt = list(targets) if targets is not None else ([(params["station_id"], params["relay"])] if "relay" in params else [])
        else:
            tgt = []
        rows = tuple(rows)
        if spec.needs_rows and not rows and not allow_empty_rows:  # WKR5ADOPT-295: only the people_csv PREVIEW has no rows yet (WisKey returns them)
            raise FeatureWireError("row_grants_missing", "not_sent")
        if not spec.needs_rows and rows:
            raise FeatureWireError("invalid_fields", "not_sent")
        try:
            body = fx.build_request(feature=feature, actor=actor, authority_ref=authority_ref, authority_revision=authority_revision, scope_ref=scope_ref,
                                    parameter_reference=parameter_reference, params=params, now=now, execution_expires_at=execution_expires_at, ttl_s=ttl_s,
                                    request_id=request_id, operation_id=operation_id)
        except fx.FeatureError as exc:
            raise FeatureWireError(exc.code, "not_sent") from None
        try:
            doc = fx.resolve_policy(conn, principals, feature=feature, targets=tgt)
        except fx.FeatureError as exc:
            raise FeatureWireError(exc.code, "not_sent") from None
        snapshot = build_policy_snapshot(identity=self.port.identity(), request=body, doc=doc, source_epoch=source_epoch, now=now,
                                         actor_session_active=actor_session_active, private_input=private_input, rows=rows)
        return body, snapshot

    def start(self, conn: sqlite3.Connection, body: dict[str, Any], snapshot: dict[str, Any], *, subscription: int | None = None) -> StartOutcome:
        if SPECS[body["feature"]].media:
            raise FeatureWireError("use_prepare_media", "not_sent")
        return self.client.start(conn, body, snapshot, subscription=subscription)

    def prepare_media(self, conn: sqlite3.Connection, body: dict[str, Any], snapshot: dict[str, Any]) -> MediaPreparation:
        return self.client.prepare_media(conn, body, snapshot)


_EVENT_ROOT = {"contract", "schema_version", "event_ref", "state", "records", "physical_result", "observed_device", "replay_available", "absence_is_never_sent_proof", "reader_boot_id", "reader_process_id"}
_EVENT_RECORD = {"operation_id", "request_id", "revision", "descriptor_epoch", "kind", "command", "trigger", "retry_of", "targets"}
_EVENT_TARGET = {"station_id", "api_relay", "physical_relay", "mapping_revision", "recorded_phase", "outcome", "duplicate", "prior_operation", "recovery_obligation", "release_recorded", "release_outcome"}
_EVENT_PHASES = {"prepared", "attempted", "acknowledged", "unknown", "denied", "duplicate", "superseded", "release_registered", "tombstone_only"}

def read_event_status(raw, event_ref):
    """Closed v1 durable READ; verified transport remains mandatory. Absence is no not-sent proof."""
    def revision(value):
        return type(value) is int and 1 <= value < 2**53
    def require(ok):
        if not ok:
            raise ValueError("invalid_event_status")
    try:
        require(isinstance(raw, Mapping) and set(raw) == _EVENT_ROOT)
        require(raw["contract"] == "wiskey-emergency-event-status.v1" and type(raw["schema_version"]) is int and raw["schema_version"] == 1)
        require(raw["event_ref"] == event_ref and raw["state"] in {"found", "not_found"})
        require(raw["physical_result"] == "unknown" and raw["observed_device"] is None)
        require(raw["replay_available"] is False and raw["absence_is_never_sent_proof"] is False)
        require(raw["reader_boot_id"] is None or _ref(raw["reader_boot_id"]))
        require(revision(raw["reader_process_id"]))
        require(isinstance(raw["records"], list) and bool(raw["records"]) == (raw["state"] == "found"))
        for record in raw["records"]:
            require(isinstance(record, Mapping) and set(record) == _EVENT_RECORD)
            require(all(_ref(record[k]) for k in ("operation_id", "request_id", "descriptor_epoch")) and revision(record["revision"]))
            require(record["kind"] in {"wiskey-emergency-event.v1", "wiskey-emergency-event.v2"})
            require(record["command"] in {"hold_open", "release"} and record["trigger"] in {"manual", "fire"})
            require(record["retry_of"] is None or _ref(record["retry_of"]))
            require(isinstance(record["targets"], list) and 1 <= len(record["targets"]) <= 200)
            for target in record["targets"]:
                require(isinstance(target, Mapping) and set(target) == _EVENT_TARGET and _ref(target["station_id"]))
                require(all(type(target[k]) is int and target[k] in {1, 2} for k in ("api_relay", "physical_relay")) and revision(target["mapping_revision"]))
                require(target["recorded_phase"] in _EVENT_PHASES and target["outcome"] == ("unknown" if target["recorded_phase"] == "attempted" else target["recorded_phase"]))
                require(all(type(target[k]) is bool for k in ("duplicate", "recovery_obligation", "release_recorded")))
                require(target["prior_operation"] is None or _ref(target["prior_operation"]))
                require(target["release_outcome"] is None or target["release_outcome"] in _EVENT_PHASES)
        return raw
    except (AssertionError, KeyError, TypeError, ValueError):
        raise FeatureWireError("invalid_event_status", "unknown") from None
