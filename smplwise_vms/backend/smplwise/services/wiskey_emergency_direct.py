"""WKCAP-295 item 12 (Q07): the Arx caller of `wiskey-emergency-event.v2` (EMERGENCY_EVENT_V2.md) behind `door_windows_engine.EmergencyEngine`.

The existing Arx dispatcher (services/door_emergency.py) calls `engine.apply(kind, station, relay, request_id, reason)` and `engine.release(kind, station, relay, request_id)`
once per door and settles the door from the returned `DoorOutcome`. `DirectEmergencyEngine` answers those calls through `features/start` on the direct transport with the
private input

    {kind: "wiskey-emergency-event.v2", event_ref, command: hold_open | release, trigger: manual | fire, retry_of: null | <operation_id of an UNKNOWN attempt>}

It adds no engine, relay mapping, journal or timer of its own: WisKey's EmergencyEventLedger / EmergencyDoorFence stay the execution roots. Arx's part is the discipline of the caller.

Rules (each one is a test in tests/test_wkcap_295.py)
- ONE attempt = one full new feature Request (new request_id, new operation_id, fresh authority and snapshot), stored in `wiskey_feature_intents` and committed BEFORE the command
  leaves. An old attempt row is never edited to make a new one; a settled attempt never moves again (`settle_feature`).
- RETRY: after an attempt whose state is `unknown` (no clear answer, or the receipt's outcome unknown) a hold may be attempted again on the same event_ref with
  `retry_of = <that attempt's operation_id>`. Never after `accepted`/`refused` (a duplicate has no extra effect) and never while the previous attempt is still LIVE (`intent`/`sent`
  with a running operation): the engine answers UNKNOWN `attempt_live` and sends nothing. The retry inherits WisKey's original deny-fence claim; Arx clears nothing.
- RELEASE WINS: once a release attempt exists for the event (durable, any state but a never-sent one) no hold or retry is sent for it any more (`superseded_by_release`, a refusal -
  nothing was sent). A release is addressed to the event_ref of the door's latest hold; with no hold on record it is refused (`no_hold_record`) - Arx never invents an event.
- LOCK is not release: `lock_secure` is not part of the v2 contract and is `not_implemented` for apply AND release. A release of an OPEN is the command `release`, nothing else.
- FIRE: the trigger `fire` is accepted only with an AUTOMATION actor carrying the original lineage (automation_id, run_id, trigger_id, creator, approver, grant_revision == the authority
  revision), supplied by the context resolver from Arx's own automation records; both creator and approver must hold the permissions (resolve_policy over both). No human is
  substituted. Arx has NO module that produces that lineage today (see the change note): the resolver is the missing producer's seam.
- No people replay: this module never touches people writes. UNKNOWN is a state, never an instruction to resend the same request.
- The effect is never confirmed physically: `finished` is WisKey's receipt (`physical_result = unknown`)."""
from __future__ import annotations

import hashlib
import sqlite3
import time
from contextlib import AbstractContextManager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Iterable

from ..rbac import Principal
from . import door_windows_engine as dwe
from . import wiskey_feature_exec as fx
from .wiskey_feature_direct import FeatureAdapters, FeatureWireError, operation_of

KIND_V2 = "wiskey-emergency-event.v2"
FEATURE = "emergency_buttons"
POLICY_REF = "emergency-event-v2"
EXEC_WINDOW_S = 900  # the request's own execution deadline; a persistent hold does not end with it (release is the only close)
HOLD_NEEDS = frozenset({"door/emergency_open", "door/hold_open", "door/restore"})
RELEASE_NEEDS = frozenset({"door/emergency_release", "door/restore"})
LIVE = ("intent", "sent")
NO_ATTEMPT_CODES = ("not_sent", "retry_parent_live")  # the command never left / the host refused a live parent: nothing happened, the chain is unchanged


def event_ref_of(request_id: str) -> str:
    """The stable event reference of one door's apply call (the dispatcher's per-door request id; never reused for another incident)."""
    return "emg-" + hashlib.sha256(request_id.encode("utf-8")).hexdigest()[:40]


def scope_ref_of(command: str, station_id: str, relay: int) -> str:
    return f"emg:{command}:" + hashlib.sha256(f"{station_id}\x1f{relay}".encode("utf-8")).hexdigest()[:32]


@dataclass(frozen=True)
class EmergencyContext:
    """Who is acting, from Arx's own records (never from the wire)."""

    actor: dict[str, Any]  # fx.human_actor(...) or fx.automation_actor(...)
    principals: tuple[Principal, ...]  # the human; for an automation BOTH creator and approver
    authority_ref: str
    authority_revision: int
    trigger: str  # manual | fire
    actor_session_active: bool

    def __post_init__(self) -> None:
        kind = self.actor.get("kind")
        if (self.trigger == "fire") != (kind == "automation") or self.trigger not in ("manual", "fire") or not self.principals:
            raise FeatureWireError("Unauthorized", "not_sent")


ContextResolver = Callable[[sqlite3.Connection, str], EmergencyContext]
Connect = Callable[[], AbstractContextManager]


def incident_context(conn: sqlite3.Connection, request_id: str) -> EmergencyContext:
    """The MANUAL context of a door call: the person who confirmed the incident (door_emergency_incidents.requested_by) and Arx's permission revision. Only `person` incidents
    resolve; any other actor kind raises (the fire lineage producer does not exist in Arx - supply your own resolver)."""
    from ..db import permission_revision

    client_id = request_id.split(":", 1)[0]
    row = conn.execute("SELECT requested_by, actor_kind FROM door_emergency_incidents WHERE request_id=? OR release_request_id=? OR release_request_id=?",
                       (client_id, client_id, client_id)).fetchone()
    if row is None or row[1] != "person":
        raise FeatureWireError("Unauthorized", "not_sent")
    user = conn.execute("SELECT id, username, display_name FROM users WHERE id=?", (row[0],)).fetchone()
    if user is None:
        raise FeatureWireError("Unauthorized", "not_sent")
    principal = Principal(user_id=user[0], username=user[1], display_name=user[2] or "", source="emergency")
    return EmergencyContext(fx.human_actor(user[0]), (principal,), "arx-permissions", permission_revision(conn), "manual", True)


# ---------------------------------------------------------------- the attempt chain (rows of wiskey_feature_intents)

@dataclass(frozen=True)
class Attempt:
    request_id: str
    operation_id: str
    state: str
    code: str | None
    request_expires_at: str


def attempts(conn: sqlite3.Connection, event_ref: str, command: str, station_id: str, relay: int) -> list[Attempt]:
    """The attempts of one command of one event on one door, oldest first. A request that never left (`not_sent`), or that the host refused because its retry parent is
    still live, changed nothing and is not an attempt."""
    rows = conn.execute("SELECT request_id, operation_id, state, code, request_expires_at FROM wiskey_feature_intents WHERE feature=? AND parameter_reference=? "
                        "AND scope_ref=? ORDER BY rowid", (FEATURE, event_ref, scope_ref_of(command, station_id, relay))).fetchall()
    return [Attempt(*r) for r in rows if not (r[2] == "refused" and r[3] in NO_ATTEMPT_CODES)]


def latest_hold_event(conn: sqlite3.Connection, station_id: str, relay: int) -> str | None:
    r = conn.execute("SELECT parameter_reference FROM wiskey_feature_intents WHERE feature=? AND scope_ref=? AND NOT (state='refused' AND code IN ('not_sent','retry_parent_live')) "
                     "ORDER BY rowid DESC LIMIT 1", (FEATURE, scope_ref_of("hold_open", station_id, relay))).fetchone()
    return r[0] if r else None


def outcome_of(token: str | None) -> dwe.DoorOutcome:
    if token == "acknowledged":
        return dwe.DoorOutcome("acknowledged", "acknowledged")
    if token in ("denied", "superseded"):
        return dwe.DoorOutcome("refused", token)
    return dwe.DoorOutcome("unknown", token or "unknown")


# ---------------------------------------------------------------- the engine

class DirectEmergencyEngine:
    simulated = False
    open_supported = True  # hold_open / release exist in v2; `lock_secure` does not
    transport_timeout_s = 6.0  # < door_emergency.ENGINE_DEADLINE_S (8 s)
    # WKR5-295 unit E: every call after an UNKNOWN attempt is a NEW attempt (new Request + operation, retry_of, same event fence); a live
    # attempt answers `attempt_live` and sends nothing; a durable release wins. door_emergency.v2_new_attempts reads this flag to let
    # the dispatcher's bounded OPEN retry run through this engine (owner approval, hand-off R5 unit E).
    new_request_per_attempt = True

    def __init__(self, adapters: FeatureAdapters, connect: Connect, context: ContextResolver = incident_context, *,
                 clock: Callable[[], datetime] | None = None, sleep: Callable[[float], None] = time.sleep, polls: int = 6, poll_gap_s: float = 0.5) -> None:
        self.adapters = adapters
        self.client = adapters.client
        self.connect = connect
        self.context = context
        self.clock = clock or (lambda: datetime.now(timezone.utc))
        self.sleep = sleep
        self.polls = polls
        self.poll_gap_s = poll_gap_s

    # -- EmergencyEngine ---------------------------------------------------------------------------------------------------------------
    def apply(self, kind: str, station_id: str, relay: int, request_id: str, reason: str) -> dwe.DoorOutcome:  # noqa: ARG002 - the reason is Arx's own audit text
        if kind != "open":
            raise dwe.EngineError("not_implemented", "emergency_secure_not_in_event_v2")
        return self._run("hold_open", station_id, relay, event_ref_of(request_id), request_id)

    def release(self, kind: str, station_id: str, relay: int, request_id: str) -> dwe.DoorOutcome:
        if kind != "open":  # a LOCK is never mapped to release (and release of a LOCK would re-activate schedules)
            raise dwe.EngineError("not_implemented", "emergency_secure_not_in_event_v2")
        with self.connect() as conn:
            event_ref = latest_hold_event(conn, station_id, relay)
        if event_ref is None:
            return dwe.DoorOutcome("refused", "no_hold_record")
        return self._run("release", station_id, relay, event_ref, request_id)

    # -- one decision ------------------------------------------------------------------------------------------------------------------
    def _run(self, command: str, station_id: str, relay: int, event_ref: str, request_id: str) -> dwe.DoorOutcome:
        with self.connect() as conn:
            self._reconcile(conn, event_ref, station_id, relay)
            holds = attempts(conn, event_ref, "hold_open", station_id, relay)
            releases = attempts(conn, event_ref, "release", station_id, relay)
            retry_of: str | None = None
            if command == "hold_open":
                if releases:  # a durable release wins over every old apply and retry
                    return dwe.DoorOutcome("refused", "superseded_by_release")
                if holds:
                    last = holds[-1]
                    if last.state in LIVE:
                        return dwe.DoorOutcome("unknown", "attempt_live")  # a live attempt is never retried
                    if last.state == "accepted":
                        return outcome_of(last.code)  # a duplicate request has no extra effect
                    if last.state == "refused":
                        return dwe.DoorOutcome("refused", last.code or "refused")
                    retry_of = last.operation_id  # UNKNOWN: a new attempt on the same fence
            elif releases:
                last = releases[-1]
                if last.state in LIVE:
                    return dwe.DoorOutcome("unknown", "attempt_live")
                if last.state == "accepted":
                    return outcome_of(last.code)
                if last.state == "refused":
                    return dwe.DoorOutcome("refused", last.code or "refused")
            return self._attempt(conn, command, station_id, relay, event_ref, retry_of, request_id)

    def _attempt(self, conn: sqlite3.Connection, command: str, station_id: str, relay: int, event_ref: str, retry_of: str | None, request_id: str) -> dwe.DoorOutcome:
        try:
            ctx = self.context(conn, request_id)
        except FeatureWireError as exc:
            return dwe.DoorOutcome("refused", exc.code)
        row = fx.relay_row(conn, station_id, relay)
        if row is None:
            return dwe.DoorOutcome("refused", "relay_map_missing")
        now = self.clock()
        private = {"kind": KIND_V2, "event_ref": event_ref, "command": command, "trigger": ctx.trigger, "retry_of": retry_of}
        try:
            body, snapshot = self.adapters.prepare(
                conn, feature=FEATURE, actor=ctx.actor, principals=ctx.principals, authority_ref=ctx.authority_ref, authority_revision=ctx.authority_revision,
                scope_ref=scope_ref_of(command, station_id, relay), parameter_reference=event_ref,
                params={"station_id": station_id, "relay": relay, "mapping_revision": row.revision, "policy_ref": POLICY_REF}, now=now,
                source_epoch=str(ctx.authority_revision), actor_session_active=ctx.actor_session_active, targets=[(station_id, relay)], private_input=private,
                execution_expires_at=now + timedelta(seconds=EXEC_WINDOW_S))
        except FeatureWireError as exc:
            return dwe.DoorOutcome("refused", exc.code)
        needs = HOLD_NEEDS if command == "hold_open" else RELEASE_NEEDS
        if not needs <= set(snapshot["permissions"]):
            return dwe.DoorOutcome("refused", "permission_missing")
        try:
            started = self.client.start(conn, body, snapshot)
        except FeatureWireError as exc:
            return dwe.DoorOutcome("refused" if exc.outcome != "unknown" else "unknown", exc.code)
        except fx.FeatureError as exc:  # duplicate request / operation id: never admitted twice
            return dwe.DoorOutcome("refused", exc.code)
        if started.state in ("refused", "not_sent"):
            return dwe.DoorOutcome("refused", started.code or "refused")
        if started.state == "unknown" or not started.operation_ref:
            return dwe.DoorOutcome("unknown", started.code or "unknown")
        return self._await(conn, body["request_id"], started.operation_ref, event_ref, command)

    # -- completion ----------------------------------------------------------------------------------------------------------------------
    def _await(self, conn: sqlite3.Connection, request_id: str, operation_ref: str, event_ref: str, command: str) -> dwe.DoorOutcome:
        for i in range(self.polls):
            token = self._read(conn, request_id, operation_ref, event_ref, command)
            if token is not None:
                return outcome_of(token)
            if i + 1 < self.polls:
                self.sleep(self.poll_gap_s)
        return dwe.DoorOutcome("unknown", "running")  # still live at the host: the intent stays `sent`, never retried while live

    def _read(self, conn: sqlite3.Connection, request_id: str, operation_ref: str, event_ref: str, command: str) -> str | None:
        """One completion read. Returns the settled token, or None while the operation is still running / the read itself failed (nothing is settled by a failed READ)."""
        try:
            res = self.client.result(operation_ref)
        except FeatureWireError:
            return None
        if res.state == "running":
            return None
        token = "receipt_unknown"
        if res.state == "finished" and res.receipt is not None:
            token = _receipt_token(res.receipt, event_ref, command)
        if token == "acknowledged":
            fx.settle_feature(conn, request_id, "accepted", "acknowledged")
        elif token in ("denied", "superseded"):
            fx.settle_feature(conn, request_id, "refused", token)
        else:
            fx.settle_feature(conn, request_id, "unknown", "receipt_unknown")
            token = "receipt_unknown"
        _commit(conn)
        return token

    def _reconcile(self, conn: sqlite3.Connection, event_ref: str, station_id: str, relay: int) -> None:
        """Before deciding: every attempt still `intent`/`sent` is read (if it has an operation) or aged into `unknown` once its request could no longer be admitted."""
        now = self.clock()
        for command in ("hold_open", "release"):
            for a in attempts(conn, event_ref, command, station_id, relay):
                if a.state not in LIVE:
                    continue
                op = operation_of(conn, a.request_id)
                if op is not None:
                    self._read(conn, a.request_id, op, event_ref, command)
                elif now >= fx.absolute_time(a.request_expires_at):
                    fx.settle_feature(conn, a.request_id, "unknown", "no_answer")  # sent, never answered: UNKNOWN (not resent as is; a retry is a NEW request)
                    _commit(conn)


def _commit(conn: sqlite3.Connection) -> None:
    """Commit by hand the way Arx does it (db.commit_now): the write lock is handed on, so no network call below ever runs inside a write transaction."""
    from ..db import commit_now

    commit_now(conn, keep_reading=False)


def _receipt_token(receipt: Any, event_ref: str, command: str) -> str:
    """The outcome token of ONE target of a closed v2 receipt; anything off-contract is `receipt_unknown`."""
    try:
        if (receipt["kind"] != KIND_V2 or receipt["event_ref"] != event_ref or receipt["command"] != command or receipt["replay_available"] is not False
                or receipt["physical_result"] != "unknown" or len(receipt["targets"]) != 1):
            return "receipt_unknown"
        outcome = receipt["targets"][0]["outcome"]
    except (KeyError, TypeError, IndexError):
        return "receipt_unknown"
    return outcome if outcome in ("acknowledged", "denied", "superseded") else "receipt_unknown"


def install(engine: DirectEmergencyEngine) -> None:
    """Make `engine` the emergency engine of this process (`door_windows_engine.EMERGENCY_ENGINE_FACTORY`). It changes NO switch and NO permit; `dwe.LIVE_ENGINE_BUILT` is the lead's
    separate decision (it also governs the window factory)."""
    dwe.EMERGENCY_ENGINE_FACTORY = lambda settings: engine  # noqa: ARG005
