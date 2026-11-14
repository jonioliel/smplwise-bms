"""WISKEY-RC7-ADOPT-2331 (rc.7 map row 6): the Native transfer adapter of the relay map export (WisKey Mac rc.7 contribution
`services/wiskey_relay_map_native.py` against Arx 876d0edf, adopted semantically - docs/changes/WISKEY-RC7-ADOPT-2331.md).

No replacement map and no second journal: the export record comes from the original exporter (services/wiskey_relay_map_export.py,
migration 0196) and the transport is the existing direct port (services/wiskey_capture_port.py), whose hello / reply MAC, connection
and correlation are already verified by the direct transport.

- `publish`: ONE original DB transaction commits the full export BEFORE any socket I/O; then `installation/relay_map_source_v1`
  (closed shape, binding = the authenticated port identity) and ONE `installation/relay_map_stage_v1`. The ACK is checked against the
  exact record (seq, content digest, repository) and means durable STAGING of exact facts only - never activation, loaded, ready or a
  door state (`activation = not_performed`, `loaded = ready = false`). A verified ACK marks the export acked locally by
  `native:<entry_id>` (the MAC-verified subject, never an upstream string). No retry, no grant, no restart, no quiesce, no ECC.
  A reply that does not verify is `relay_export_invalid_ack` with outcome `unknown` (never replayed).
- `publish_selected`: the post-approval sync of routers/wiskey_relay_map.py - only with the owner's `wiskey.auto_install` switch ON
  (owner decision 1B: nothing turns it on), only while the direct join selects both commands, stage v1 only, within the caller's
  absolute deadline.
- `prepare_quiesced`: v1 / v2 prepare of a staged export. Its ONLY intended caller is the original controller's `maintenance_v1`
  (REPLY_TO_WISKEY_RC7_INTAKE section 3), which is NOT_BUILT until WisKey confirms the ABI; it therefore demands a maintenance token
  and no production module calls it (pinned by tests/test_wiskey_rc7_adopt_2331.py).
- `maintain` (WisKey M12 policy B, slice S3 - relay-maintenance-v1, contribution M12-POLICY-B.20261102.01 adopted semantically,
  DORMANT): the original controller's `maintenance_v1` caller of `installation/relay_map_prepare_v3`. Nothing at all while the owner's
  switch is OFF; `blocked / relay_witness_unavailable` without a witness provider - and no production code passes one (the Q2 lineage
  producer is NOT_BUILT) nor calls `maintain`, so the path is unreachable in this build (tests/test_wiskey_m12_s3_maintenance.py).
  Order (LIFECYCLE_ORDER_CLARIFICATION wins over the shortened sentence of the old CONTRACT_HE): signed readiness + loaded pair + current
  export, then the intent COMMITTED in the one SQLite journal and PUBLISHED with witness null, and only then - outside DB,
  JOURNAL_LOCK and the fence - the witness provider; CAS bind, publish, CAS invalidated + publish, CAS dispatched + publish, then ONE
  prepare_v3 request outside every lock, all within ONE absolute budget. After dispatch every failure is UNKNOWN, never replayed.
"""
from __future__ import annotations

import contextvars
import copy
import logging
import time
import uuid
from typing import Any

from . import wiskey_call_budget as budget
from . import wiskey_relay_map_export as exporter
from .wiskey_capture_port import PortError

SOURCE = "installation/relay_map_source_v1"
STAGE = "installation/relay_map_stage_v1"
PREPARE = "installation/relay_map_prepare_v1"
STAGE_V2 = "installation/relay_map_stage_v2"
PREPARE_V2 = "installation/relay_map_prepare_v2"
PREPARE_V3 = "installation/relay_map_prepare_v3"  # S3: only from `maintain` (dormant)
READINESS = "installation/readiness_v1"
COMMANDS = (SOURCE, STAGE, PREPARE, PREPARE_V2, STAGE_V2, PREPARE_V3)
CONTRACT = "wiskey-relay-map-transfer.v1"
CONTRACT_V2 = "wiskey-relay-map-activation.v2"
ACK_CONTRACT = "wiskey-relay-map-ack.v1"
SOURCE_FIELDS = frozenset({"contract", "schema_version", "binding", "inventory", "anti_rollback_scope", "full_restore_continuity"})
ACK_FIELDS = frozenset({"contract", "schema_version", "state", "code", "seq", "content_digest", "repository_id", "projection_sha256",
                        "activation", "loaded", "ready"})
DEFAULT_TIMEOUT_S = 10.0


def _source(port: Any, timeout_s: float) -> dict[str, Any]:
    source = dict(port.call(SOURCE, {}, timeout_s=budget.remaining(timeout_s)))
    if (set(source) != SOURCE_FIELDS or source.get("contract") != CONTRACT or type(source.get("schema_version")) is not int
            or source["schema_version"] != 1):
        raise PortError("relay_export_invalid_source_response", "refused")
    identity = port.identity()
    binding = source["binding"]
    if (not isinstance(binding, dict) or binding.get("repository_id") != identity.repository_id
            or binding.get("bridge_entry_id") != identity.entry_id or binding.get("query_owner_id") != identity.query_owner_id
            or binding.get("connection_ref") != identity.connection_ref):
        raise PortError("relay_export_source_binding_changed", "refused")
    return source


def _ack(reply: Any, record: dict[str, Any], source: dict[str, Any]) -> dict[str, Any]:
    if (not isinstance(reply, dict) or set(reply) != ACK_FIELDS
            or reply["contract"] != ACK_CONTRACT or type(reply["schema_version"]) is not int or reply["schema_version"] != 1
            or type(reply["seq"]) is not int or reply["seq"] != record["seq"] or reply["content_digest"] != record["content_digest"]
            or reply["repository_id"] != source["binding"]["repository_id"] or reply["state"] not in {"staged", "unchanged", "prepared"}
            or reply["activation"] != "not_performed" or reply["loaded"] is not False or reply["ready"] is not False
            or not isinstance(reply["projection_sha256"], str) or len(reply["projection_sha256"]) != 64
            or any(c not in "0123456789abcdef" for c in reply["projection_sha256"])):
        raise PortError("relay_export_invalid_ack", "unknown")
    return reply


def publish(db: Any, port: Any, *, by: str, timeout_s: float = DEFAULT_TIMEOUT_S, version: int = 1) -> dict[str, Any]:
    """One committed snapshot, one authenticated stage and one verified ACK. The caller hands an already selected direct port. No frame
    is sent under a DB or generation lock; a failed COMMIT raises before anything is sent."""
    if version not in (1, 2):
        raise PortError("relay_export_version_unavailable", "not_sent")
    with budget.scope(timeout_s):
        with db.connection(label="relay export commit-before-publish") as conn:
            record = exporter.export(conn, by=by).full()
        # Leaving the connection context commits (or raises). This point never moves into the transaction or a generation lock.
        source = _source(port, timeout_s)
        payload = {"contract": CONTRACT if version == 1 else CONTRACT_V2, "schema_version": version, "binding": source["binding"],
                   "record": record}
        reply = _ack(dict(port.call(STAGE if version == 1 else STAGE_V2, payload, timeout_s=budget.remaining(timeout_s))), record, source)
        if reply["code"] is not None:
            return {"state": "staged_activation_blocked", "ack": reply, "record": record}
        if reply["state"] not in {"staged", "unchanged"}:
            raise PortError("relay_export_invalid_ack_stage", "unknown")
        identity = port.identity()  # the MAC-verified direct subject, not an upstream by-string
        with db.connection(label="relay export authenticated staged ack") as conn:
            acked = exporter.ack(conn, seq=record["seq"], content_digest=record["content_digest"], by="native:" + identity.entry_id).full()
        return {"state": "staged", "ack": reply, "record": acked}


def prepare_quiesced(db: Any, port: Any, staged: dict[str, Any], *, maintenance_token: str, timeout_s: float = DEFAULT_TIMEOUT_S,
                     version: int = 1) -> dict[str, Any]:
    """Prepare a staged export - ONLY inside the original controller's authorized quiescent `maintenance_v1` (NOT_BUILT: the caller
    passes the maintenance token it holds by CAS). This adapter never unloads an entry and never asks for a restart; the token is
    not sent (the ABI is not agreed yet) and is only required so that no other path can reach this function."""
    if not isinstance(maintenance_token, str) or not maintenance_token:
        raise PortError("relay_export_maintenance_required", "not_sent")
    if version not in (1, 2):
        raise PortError("relay_export_version_unavailable", "not_sent")
    with budget.scope(timeout_s):
        record = staged["record"]
        with db.connection(mode="read", label="relay export still current") as conn:
            current = exporter.get(conn, record["seq"])
            if current.stale or not current.current or current.kind != "export":
                raise PortError("relay_export_not_current", "not_sent")
        source = _source(port, timeout_s)
        payload = {"contract": CONTRACT if version == 1 else CONTRACT_V2, "schema_version": version, "binding": source["binding"],
                   "seq": record["seq"], "content_digest": record["content_digest"], "projection_sha256": staged["ack"]["projection_sha256"]}
        reply = dict(port.call(PREPARE if version == 1 else PREPARE_V2, payload, timeout_s=budget.remaining(timeout_s)))
        return _ack(reply, record, source)


def publish_selected(db: Any, *, by: str, deadline: float) -> dict[str, Any]:
    """The automatic post-approval software sync (stage v1 only). Owner decision 1B: nothing at all - no join lookup, no I/O - unless
    the owner switched `wiskey.auto_install` on; then only through the existing selection rule."""
    from .wiskey_auto_install import switch_on_db
    from .wiskey_direct_join import installed

    if not switch_on_db(db):
        return {"state": "switch_off"}
    with budget.until(deadline):
        join = installed()
        if join is None or not join.selected(SOURCE) or not join.selected(STAGE):
            return {"state": "not_selected"}
        return publish(db, join.capture_port, by=by, timeout_s=budget.remaining(DEFAULT_TIMEOUT_S))


log = logging.getLogger(__name__)


def _local(fn: Any, *args: Any, **kwargs: Any) -> Any:
    """Run LOCAL journal bookkeeping (a CAS, the file publication - no transport I/O) outside the caller's call budget: once the one
    absolute end has passed, the database layer would refuse every write inside it (db._begin_immediate honours the budget), and the
    cancelled / UNKNOWN / proof record must still be kept."""
    return contextvars.Context().run(fn, *args, **kwargs)


def _settle(db: Any, root: Any, generation_id: str, token: str, expected: str, state: str) -> None:
    """Best effort, outside the budget: move the intent to a terminal / UNKNOWN state by CAS and publish it. Never raises (the
    caller's answer stands); a CAS that does not match (another state, generation or token) changes nothing."""
    from . import wiskey_install_generation as gen, wiskey_native_projection as projection

    def run() -> None:
        if gen.maintenance_transition(db, generation_id=generation_id, token=token, expected=expected, state=state) == state:
            projection.publish_maintenance(db, root, generation_id=generation_id, token=token)

    try:
        _local(run)
    except Exception as exc:  # noqa: BLE001 - the evidence write may fail; the journal keeps the last committed state
        log.warning("maintenance %s evidence unavailable (%s)", state, type(exc).__name__)


def _published(db: Any, root: Any, generation_id: str, token: str, state: str) -> bool:
    from . import wiskey_native_projection as projection

    try:
        return projection.publish_maintenance(db, root, generation_id=generation_id, token=token) == state
    except Exception as exc:  # noqa: BLE001 - typed fence refusal / busy / OS error: not published
        log.warning("maintenance %s not published (%s)", state, type(exc).__name__)
        return False


class _Stop(Exception):
    def __init__(self, answer: dict[str, Any], settle: str | None) -> None:
        super().__init__(answer.get("code"))
        self.answer, self.settle = answer, settle


def maintain(db: Any, port: Any, staged: dict[str, Any], *, root: Any, by: str, witness_provider: Any = None,
             timeout_s: float = DEFAULT_TIMEOUT_S) -> dict[str, Any]:
    """The original controller's maintenance_v1 (prepare_v3) - DORMANT, see the module docstring. `staged` is publish()'s answer
    for the export to prepare; `witness_provider(intent, binding)` is the adopted original lineage producer (Q2, NOT_BUILT): it is
    called once, outside every lock, after the intent is committed and published, and returns a witness.v1 or None."""
    from .wiskey_auto_install import switch_on_db

    if not switch_on_db(db):
        return {"state": "switch_off"}  # policy B: no I/O, no read of the join, no journal write
    if witness_provider is None:
        return {"state": "blocked", "code": "relay_witness_unavailable"}  # no default, no fake, no fixed UUID / epoch file
    from . import wiskey_install_generation as gen, wiskey_native_projection as projection
    from .wiskey_r2_contracts import read_readiness

    with budget.scope(timeout_s):  # ONE absolute end for every outside call below, the provider included
        source = _source(port, timeout_s)
        readiness = read_readiness(dict(port.call(READINESS, {}, timeout_s=budget.remaining())))
        journal = gen.read(db)
        loaded = readiness.get("loaded")
        if (journal is None or journal.get("state") != gen.REQUESTED or readiness.get("state") != "ready"
                or readiness.get("generation_id") != journal["generation_id"] or not isinstance(loaded, dict)
                or projection.pair_digest(loaded) != journal.get("digest")):
            return {"state": "refused", "code": "relay_maintenance_pair_not_loaded"}
        record = staged["record"]
        with db.connection(mode="read", label="maintenance current committed export") as conn:
            live = exporter.get(conn, record["seq"])
            if live.stale or not live.current or live.kind != "export":
                return {"state": "refused", "code": "relay_export_not_current"}
        binding = source["binding"]
        gid, token = journal["generation_id"], uuid.uuid4().hex
        intent = {"contract": gen.MAINTENANCE_CONTRACT, "schema_version": 1, "producer": gen.MAINTENANCE_PRODUCER,
                  "generation_id": gid, "source_digest": journal["digest"], "token": token, "actor": by,
                  "repository_id": binding["repository_id"], "bridge_entry_id": binding["bridge_entry_id"],
                  "query_owner_id": binding["query_owner_id"], "native_boot_id": readiness["boot_id"], "seq": record["seq"],
                  "content_digest": record["content_digest"], "projection_sha256": staged["ack"]["projection_sha256"],
                  "deadline_unix_ms": int((time.time() + budget.remaining()) * 1000), "state": "intent", "witness": None}
        begun = gen.begin_maintenance(db, intent)  # COMMIT first (DB -> JOURNAL_LOCK)
        if begun != "intent":
            return {"state": begun, "code": "relay_maintenance_stale" if begun == gen.STALE else "relay_maintenance_refused"}
        try:
            # publish the COMMITTED intent (witness null: evidence only, admits nothing) BEFORE the outside provider
            if not _published(db, root, gid, token, "intent"):
                raise _Stop({"state": "stale", "code": "relay_maintenance_stale"}, "cancelled")
            try:  # outside DB, JOURNAL_LOCK and the fence; inside the one budget
                budget.remaining()
                witness = witness_provider(copy.deepcopy(intent), copy.deepcopy(binding))
                budget.remaining()
            except budget.DeadlineExpired:
                raise
            except Exception as exc:  # noqa: BLE001 - a failing provider is no witness
                log.warning("maintenance witness provider failed (%s)", type(exc).__name__)
                raise _Stop({"state": "refused", "code": "relay_witness_failed"}, "refused") from None
            if witness is None:
                raise _Stop({"state": "blocked", "code": "relay_witness_unavailable"}, "refused")
            bound = gen.bind_maintenance_witness(db, generation_id=gid, token=token, witness=witness)  # CAS
            if bound != "intent":
                raise _Stop({"state": "stale" if bound == gen.STALE else "refused",
                             "code": "relay_maintenance_stale" if bound == gen.STALE else "relay_witness_refused"}, "refused")
            intent["witness"] = copy.deepcopy(witness)
            if not _published(db, root, gid, token, "intent"):  # the witness-bound intent
                raise _Stop({"state": "stale", "code": "relay_maintenance_stale"}, "cancelled")
            # invalidated retires the earlier maintenance admission (never controller.v1); CAS, then publication
            if gen.maintenance_transition(db, generation_id=gid, token=token, expected="intent", state="invalidated") != "invalidated":
                raise _Stop({"state": "cancelled", "code": "relay_maintenance_not_published"}, "cancelled")
            if not _published(db, root, gid, token, "invalidated"):
                raise _Stop({"state": "cancelled", "code": "relay_maintenance_not_published"}, "cancelled")
            # dispatched: CAS (refused past the intent's deadline, with the switch OFF or without a witness) - before any I/O
            budget.remaining()
            if gen.maintenance_transition(db, generation_id=gid, token=token, expected="invalidated", state="dispatched") != "dispatched":
                raise _Stop({"state": "cancelled", "code": "relay_maintenance_not_dispatched"}, "cancelled")
        except _Stop as stop:
            for expected in ("intent", "invalidated"):  # CAS: only the state actually reached moves
                _settle(db, root, gid, token, expected, stop.settle)
            return stop.answer
        except Exception as exc:  # noqa: BLE001 - the end passed / a database error before dispatch: nothing was sent
            for expected in ("intent", "invalidated"):
                _settle(db, root, gid, token, expected, "cancelled")
            if isinstance(exc, budget.DeadlineExpired):
                return {"state": "cancelled", "code": "deadline_expired"}
            raise
        # From here the attempt exists: any failure is UNKNOWN (a signed error is not proof of no effect); never replayed.
        hashed = gen.intent_sha256(intent)
        try:
            if not _published(db, root, gid, token, "dispatched"):
                raise PortError("relay_maintenance_stale", "unknown")
            payload = {"contract": gen.MAINTENANCE_CONTRACT, "schema_version": 1, "binding": binding, "seq": record["seq"],
                       "content_digest": record["content_digest"], "projection_sha256": intent["projection_sha256"],
                       "token": token, "intent_sha256": hashed}
            result = dict(port.call(PREPARE_V3, payload, timeout_s=budget.remaining()))
        except Exception as error:
            _settle(db, root, gid, token, "dispatched", "unknown")
            raise PortError("relay_maintenance_outcome_unknown", "unknown") from error
    # the answer is in: verified and recorded locally, outside the (possibly just ended) budget
    try:
        if (set(result) != gen.RESULT_FIELDS or result.get("contract") != gen.RESULT_CONTRACT
                or type(result.get("schema_version")) is not int or result["schema_version"] != 1
                or result.get("generation_id") != gid or result.get("token") != token or result.get("intent_sha256") != hashed
                or result.get("replay_available") is not False):
            raise PortError("relay_maintenance_invalid_proof", "unknown")
        _ack(result["ack"], record, source)
        if _local(gen.maintenance_transition, db, generation_id=gid, token=token, expected="dispatched", state="prepared",
                  proof=result) != "prepared":
            raise PortError("relay_maintenance_invalid_proof", "unknown")
    except Exception as error:
        _settle(db, root, gid, token, "dispatched", "unknown")
        raise PortError("relay_maintenance_outcome_unknown", "unknown") from error
    if not _local(_published, db, root, gid, token, "prepared"):
        log.warning("maintenance prepared committed, file not published")  # the proof is in the journal
    return {"state": "prepared", "result": result}
