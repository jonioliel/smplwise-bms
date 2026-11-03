"""WISKEY-R2-ALIGN-2272: the installation generation journal (semantic adoption of WisKey R2 `installation_generation`, with the
finding WIN-R2-ARX-GEN-01 fixed in Arx's own code - docs/changes/WISKEY-R2-ALIGN-2272.md).

One journal document per Arx install (setting `wiskey.installation.generation`, never in a backup: prefix `wiskey.installation.`):
{generation_id, digest, state, claim, proof, updated}. A generation is one staged source digest. Rules:

* every read-modify-write acquires the original DB writer BEFORE the shared process lock and runs inside a write transaction (BEGIN IMMEDIATE), so a read and the write
  that follows it can not be separated by another thread or process;
* every update is a compare-and-set on (generation_id, expected state, claim token); a mismatch changes nothing and says `stale`;
* the lock is released BEFORE any outside I/O (platform restart call, WisKey registry read); the outcome is applied afterwards by a
  fresh CAS, so a late result of generation A can never mark or overwrite generation B;
* nothing here has an effect by itself: callers are behind `wiskey.auto_install` (default OFF; policy B: only the owner's explicit
  action turns it on, no code does).

WisKey M12 policy B, slice S3 (contribution M12-POLICY-B.20261102.01, relay-maintenance-v1; adopted semantically, DORMANT):

* every writer that changes the decision (generation, digest, claim) withdraws the published admissions (controller.v1 and
  maintenance.v1) under the original publication fence BEFORE the journal row changes, in the order DB -> JOURNAL_LOCK -> fence, and
  keeps the fence until its write transaction has ENDED - also inside a caller's transaction such as the add-on start-up
  (db.on_transaction_end). Without fcntl it refuses typed (`generation_fence_unsupported`); nothing is withdrawn or created when no
  projection directory exists;
* the maintenance extension lives in THIS journal document (`format` arx.wiskey.installation-generation.v2, `schema_version` 2,
  `maintenance_v1`, `maintenance_proof`, `maintenance_history`): no second journal, counter, restart or generation. The intent is
  committed (witness null) and published BEFORE the outside witness provider is called; the witness is bound by CAS; then
  invalidated -> dispatched (CAS, then publication) before the one prepare_v3 request outside every lock. After dispatch a lost or
  unverifiable answer is UNKNOWN; UNKNOWN is never replayed and only an exact verified completion proof settles it. A superseded
  intent is archived (attempted -> unknown, not attempted -> cancelled) in the same document; 128 intents / 2 MiB refuse, never drop;
* `begin_maintenance` and the forward transitions refuse while the owner's switch is OFF, and the only caller
  (wiskey_relay_map_native.maintain) is blocked without a witness provider: no production code passes one (Q2 lineage producer
  NOT_BUILT), so the whole path is unreachable in this build.
"""

from __future__ import annotations

import copy
import hashlib
import json
import re
import threading
import time
import uuid
from contextlib import ExitStack, contextmanager
from pathlib import Path
from typing import Any, Callable, Iterator

GENERATION_KEY = "wiskey.installation.generation"
RESTART_DIGEST_KEY = "wiskey.installation.restart_digest"  # kept in step with the journal (older readers / tests)

STAGED, CLAIMED, REQUESTED, UNKNOWN = (
    "staged",
    "restart_claimed",
    "restart_requested",
    "restart_unknown",
)
STALE = "stale"

JOURNAL_LOCK = (
    threading.RLock()
)  # the one shared lock of every journal read-modify-write
_test_hook: Callable[[str], None] | None = (
    None  # tests only: called inside the critical section, never set in production
)


def _hook(point: str) -> None:
    if _test_hook is not None:
        _test_hook(point)


@contextmanager
def _tx(db: Any, conn: Any, label: str) -> Iterator[Any]:
    if conn is not None:  # the caller's own write transaction
        yield conn
        return
    with db.write_aside(label=label) as c:
        yield c


def _load(conn: Any) -> dict[str, Any] | None:
    from ..db import get_setting

    raw = get_setting(conn, GENERATION_KEY)
    if not raw:
        return None
    try:
        doc = json.loads(raw)
    except ValueError:
        return None
    return (
        doc
        if isinstance(doc, dict) and isinstance(doc.get("generation_id"), str)
        else None
    )


_DECISION = ("generation_id", "digest", "claim")  # the fields an admission (controller.v1 / maintenance.v1) is bound to


def _store(conn: Any, doc: dict[str, Any]) -> None:
    from ..db import set_setting

    doc["updated"] = round(time.time(), 3)
    value = json.dumps(doc, sort_keys=True, separators=(",", ":"))
    previous = _load(conn)
    if previous is None or any(previous.get(k) != doc.get(k) for k in _DECISION):
        _withdraw_then_set(conn, value)
    else:
        set_setting(conn, GENERATION_KEY, value)


def _withdraw_then_set(conn: Any, value: str) -> None:
    """S3: the SAME authoritative mutation, DB -> JOURNAL_LOCK -> fence. Pull the admissions before the decision changes and hold
    the fence until the caller's transaction ends (committed or rolled back): Native, which takes only the fence, never sees the
    new decision half-written nor an old admission next to it. A failed commit leaves a conservative unavailable projection."""
    from ..db import on_transaction_end, set_setting
    from . import wiskey_native_projection as projection
    from .bridge_install import ha_config_dir

    root = ha_config_dir()
    parent = None if root is None else (Path(root) / projection.RELATIVE).parent
    if parent is None or not (parent.is_dir() or parent.is_symlink()):
        set_setting(conn, GENERATION_KEY, value)  # nothing was ever published: nothing to withdraw, nothing created
        return
    with ExitStack() as stack:
        stack.enter_context(projection.generation_fence(root))  # typed refusal without fcntl; busy -> generation_fence_busy
        for relative in (projection.RELATIVE, projection.MAINTENANCE_RELATIVE):
            (Path(root) / relative).unlink(missing_ok=True)
        projection._sync(parent)
        set_setting(conn, GENERATION_KEY, value)
        held = stack.pop_all()
    if not on_transaction_end(conn, held.close):
        held.close()


def read(db: Any, conn: Any = None) -> dict[str, Any] | None:
    if conn is not None:
        return _load(conn)
    with db.connection(mode="read", label="wiskey generation read") as c:
        return _load(c)


def begin(db: Any, conn: Any, digest: str) -> str:
    """The generation for this staged digest: the current one when its digest is the same, otherwise a NEW generation (state `staged`)
    that supersedes the old one. A legacy restart claim for the same digest (setting only, no journal) is carried over as claimed."""
    from ..db import get_setting

    with _tx(db, conn, "wiskey generation begin") as c:
        with JOURNAL_LOCK:
            cur = _load(c)
            _hook("begin:read")
            if cur is not None and cur.get("digest") == digest:
                return str(cur["generation_id"])
            doc: dict[str, Any] = {
                "generation_id": uuid.uuid4().hex,
                "digest": digest,
                "state": STAGED,
                "claim": None,
                "proof": None,
            }
            if cur is not None and cur.get("format") == JOURNAL_V2:
                # S3: the earlier intents / UNKNOWN stay in this SAME journal (attempted -> unknown, not attempted -> cancelled);
                # a full history refuses the new generation before anything is lost (ValueError, nothing written)
                doc.update(format=JOURNAL_V2, schema_version=2, maintenance_v1=None, maintenance_proof=None,
                           maintenance_history=_archive_maintenance(cur))
            if get_setting(c, RESTART_DIGEST_KEY) == digest:
                doc.update(state=UNKNOWN, claim="legacy")
            _store(c, doc)
            return str(doc["generation_id"])


def claim_restart(db: Any, conn: Any, generation_id: str, digest: str) -> str | None:
    """CAS `staged -> restart_claimed` for exactly this generation and digest. Returns the claim token, or None when the generation is
    not current, is not `staged`, or the digest was already claimed (so two requests can never both go out)."""
    from ..db import set_setting

    with _tx(db, conn, "wiskey generation claim") as c:
        with JOURNAL_LOCK:
            cur = _load(c)
            _hook("claim:read")
            if (
                cur is None
                or cur.get("generation_id") != generation_id
                or cur.get("digest") != digest
                or cur.get("state") != STAGED
            ):
                return None
            token = uuid.uuid4().hex
            cur.update(state=CLAIMED, claim=token)
            _store(c, cur)
            set_setting(c, RESTART_DIGEST_KEY, digest)
            return token


def finish_restart(db: Any, conn: Any, generation_id: str, claim: str, ok: bool) -> str:
    """Apply the outcome of the restart call (made OUTSIDE the lock) by CAS on (generation, claim, state `restart_claimed`).
    A superseded generation or a foreign claim returns `stale` and writes nothing."""
    with _tx(db, conn, "wiskey generation finish") as c:
        with JOURNAL_LOCK:
            cur = _load(c)
            _hook("finish:read")
            if (
                cur is None
                or cur.get("generation_id") != generation_id
                or cur.get("claim") != claim
                or cur.get("state") != CLAIMED
            ):
                return STALE
            cur["state"] = REQUESTED if ok else UNKNOWN
            _store(c, cur)
            return str(cur["state"])


def record_proof(db: Any, generation_id: str, intent: str, outcome: str) -> str:
    """Merge a proof (e.g. the reconcile outcome) into the journal ONLY when the stored generation is still `generation_id` (the one
    the caller read before its outside I/O) and the intent is a closed known one. Anything else is `stale`: B's journal is never
    overwritten by A's proof. The state / claim / digest are never touched by a proof."""
    if intent not in ("reconcile",):
        return STALE
    with _tx(db, None, "wiskey generation proof") as c:
        with JOURNAL_LOCK:
            cur = _load(c)
            _hook("proof:read")
            if cur is None or cur.get("generation_id") != generation_id:
                return STALE
            cur["proof"] = {
                "intent": intent,
                "outcome": outcome,
                "at": round(time.time(), 3),
            }
            _store(c, cur)
            return "recorded"


# ---------------------------------------------------------------- WisKey M12 policy B, slice S3: maintenance_v1 (DORMANT)

JOURNAL_V2 = "arx.wiskey.installation-generation.v2"
MAINTENANCE_CONTRACT = "wiskey-relay-map-maintenance.v1"
MAINTENANCE_PRODUCER = "arx-sqlite:wiskey.installation.generation/maintenance.v1"
MAINTENANCE_KEY = "maintenance_v1"
RESULT_CONTRACT = "wiskey-relay-maintenance-result.v1"
WITNESS_CONTRACT = "arx.wiskey.relay-restore-witness.v1"
MAINTENANCE_STATES: dict[str, set[str]] = {
    "intent": {"invalidated", "cancelled", "refused"},
    "invalidated": {"dispatched", "cancelled", "refused"},
    "dispatched": {"prepared", "unknown"},  # after dispatch: never cancelled / refused / no-effect
    "unknown": {"prepared"},  # only an exact, verified completion proof of the same intent
    "cancelled": set(), "prepared": set(), "refused": set(),
}
ACTIVE = frozenset({"intent", "invalidated", "dispatched", "unknown"})
HISTORY_MAX, HISTORY_MAX_BYTES = 128, 2 * 1024 * 1024
INTENT_FIELDS = frozenset({"contract", "schema_version", "producer", "generation_id", "source_digest", "token", "actor",
                           "repository_id", "bridge_entry_id", "query_owner_id", "native_boot_id", "seq", "content_digest",
                           "projection_sha256", "deadline_unix_ms", "state", "witness"})
WITNESS_FIELDS = frozenset({"contract", "schema_version", "producer", "scope", "incarnation_id", "checkpoint", "anchor", "head",
                            "status", "repository_id", "bridge_entry_id", "query_owner_id", "generation_id", "token", "boot_id",
                            "connection_ref", "seq", "content_digest", "position", "anchor_position", "head_position"})
RESULT_FIELDS = frozenset({"contract", "schema_version", "generation_id", "token", "intent_sha256", "state", "startup_committed",
                           "entries_reloaded", "ack", "replay_available"})
ACK_FIELDS = frozenset({"contract", "schema_version", "state", "code", "seq", "content_digest", "repository_id", "projection_sha256",
                        "activation", "loaded", "ready"})
_TEXT = re.compile(r"[^\x00-\x1f\x7f]+")
_HEX64 = re.compile(r"[0-9a-f]{64}")
_CONTENT = re.compile(r"sha256:[0-9a-f]{64}")
_MAX_INT = 9007199254740991


def _text(value: Any) -> bool:
    return type(value) is str and _TEXT.fullmatch(value) is not None


def _count(value: Any) -> bool:
    return type(value) is int and 1 <= value <= _MAX_INT


def _hex64(value: Any) -> bool:
    return type(value) is str and _HEX64.fullmatch(value) is not None


def _now_ms() -> int:
    return int(time.time() * 1000)


def intent_sha256(intent: dict[str, Any]) -> str:
    """The digest the prepare_v3 request and the completion proof carry: the exact stored intent (witness bound) without `state`."""
    return hashlib.sha256(json.dumps({k: v for k, v in intent.items() if k != "state"}, sort_keys=True, separators=(",", ":"),
                                     ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def _intent_ok(intent: Any) -> bool:
    """The closed intent.v1 shape at commit time: state `intent`, witness NOT yet bound (it is collected after publication), a
    deadline still ahead."""
    return (isinstance(intent, dict) and set(intent) == INTENT_FIELDS and intent["contract"] == MAINTENANCE_CONTRACT
            and type(intent["schema_version"]) is int and intent["schema_version"] == 1 and intent["producer"] == MAINTENANCE_PRODUCER
            and all(_text(intent[k]) for k in ("generation_id", "source_digest", "token", "actor", "repository_id", "bridge_entry_id",
                                                "query_owner_id", "native_boot_id"))
            and _count(intent["seq"]) and type(intent["content_digest"]) is str
            and _CONTENT.fullmatch(intent["content_digest"]) is not None and _hex64(intent["projection_sha256"])
            and _count(intent["deadline_unix_ms"]) and intent["deadline_unix_ms"] > _now_ms()
            and intent["state"] == "intent" and intent["witness"] is None)


def _witness_ok(witness: Any, row: dict[str, Any]) -> bool:
    """The closed witness.v1 shape, `current`, and bound to exactly this intent (generation, token, export, subject). Shape and
    binding only: the lineage freshness is the producer's proof (Q2), which Arx does not have yet."""
    return (isinstance(witness, dict) and set(witness) == WITNESS_FIELDS and witness["contract"] == WITNESS_CONTRACT
            and type(witness["schema_version"]) is int and witness["schema_version"] == 1
            and witness["producer"] == "arx-original-lineage:relay/v1" and witness["scope"] == "outside_core_and_arx_restore"
            and witness["status"] == "current" and all(_hex64(witness[k]) for k in ("checkpoint", "anchor", "head"))
            and all(_text(witness[k]) for k in ("incarnation_id", "boot_id", "connection_ref"))
            and all(_count(witness[k]) for k in ("seq", "position", "anchor_position", "head_position"))
            and all(witness[k] == row[k] for k in ("generation_id", "token", "seq", "content_digest", "repository_id",
                                                   "bridge_entry_id", "query_owner_id")))


def _proof_ok(proof: Any, row: dict[str, Any], generation_id: str, token: str) -> bool:
    """The exact completion proof of THIS intent (result.v1 + the ACK of the same export). A signed error, an open or extra field, a
    bool for an int, another digest: refused."""
    if (not isinstance(proof, dict) or set(proof) != RESULT_FIELDS or proof["contract"] != RESULT_CONTRACT
            or type(proof["schema_version"]) is not int or proof["schema_version"] != 1
            or proof["generation_id"] != generation_id or proof["token"] != token or proof["state"] != "prepared"
            or proof["startup_committed"] is not True or proof["entries_reloaded"] is not True or proof["replay_available"] is not False
            or proof["intent_sha256"] != intent_sha256(row)):
        return False
    ack = proof["ack"]
    return (isinstance(ack, dict) and set(ack) == ACK_FIELDS and ack["contract"] == "wiskey-relay-map-ack.v1"
            and type(ack["schema_version"]) is int and ack["schema_version"] == 1 and type(ack["seq"]) is int
            and all(ack[k] == row[k] for k in ("seq", "content_digest", "projection_sha256", "repository_id"))
            and ack["state"] in ("prepared", "unchanged") and ack["code"] is None and ack["activation"] == "not_performed"
            and ack["loaded"] is False and ack["ready"] is False)


def _switch_on(conn: Any) -> bool:
    from .wiskey_auto_install import switch_on

    return switch_on(conn)


def begin_maintenance(db: Any, intent: dict[str, Any]) -> str:
    """COMMIT the maintenance intent into THIS journal (witness null), before its publication and before any outside I/O. Only for
    the current generation in `restart_requested` with no active intent; no new generation, digest, claim, restart or counter.
    `refused`: switch OFF (policy B - the journal writer itself is dormant), a malformed / expired intent, a reused token or a full
    history; `stale`: another generation / digest / state, or an intent still active (UNKNOWN is never replayed)."""
    if not _intent_ok(intent):
        return "refused"
    with _tx(db, None, "maintenance v1 committed intent") as conn:
        with JOURNAL_LOCK:
            if not _switch_on(conn):
                return "refused"
            cur = _load(conn)
            _hook("maintenance:begin")
            row = None if cur is None else cur.get(MAINTENANCE_KEY)
            if (cur is None or cur["generation_id"] != intent["generation_id"] or cur.get("digest") != intent["source_digest"]
                    or cur.get("state") != REQUESTED or (isinstance(row, dict) and row.get("state") in ACTIVE)):
                return STALE
            try:
                history = _archive_maintenance(cur)
            except ValueError:
                return "refused"  # capacity / conflict: refuse before anything is lost
            if intent["token"] in history:
                return "refused"  # a token names one intent forever
            cur.update(format=JOURNAL_V2, schema_version=2, maintenance_history=history, maintenance_proof=None)
            cur[MAINTENANCE_KEY] = copy.deepcopy(intent)
            _store(conn, cur)
    return "intent"


def bind_maintenance_witness(db: Any, *, generation_id: str, token: str, witness: Any) -> str:
    """Bind the original witness by CAS AFTER the intent was committed and published (LIFECYCLE_ORDER_CLARIFICATION: never collected
    under a lock or before the intent is published). Only once, only while the intent is still `intent` of the current generation."""
    with _tx(db, None, "maintenance original witness binding") as conn:
        with JOURNAL_LOCK:
            cur = _load(conn)
            _hook("maintenance:bind")
            row = None if cur is None else cur.get(MAINTENANCE_KEY)
            if (cur is None or cur["generation_id"] != generation_id or not isinstance(row, dict) or row.get("token") != token
                    or row.get("state") != "intent" or row.get("witness") is not None):
                return STALE
            if not _witness_ok(witness, row):
                return "refused"
            row["witness"] = copy.deepcopy(witness)
            _store(conn, cur)
            return "intent"


def maintenance_transition(db: Any, *, generation_id: str, token: str, expected: str, state: str, proof: Any = None) -> str:
    """Late CAS on (generation, token, expected state). Forward steps (invalidated, dispatched) need a bound witness and the owner's
    switch; `dispatched` also the intent's absolute deadline still ahead. `prepared` needs the exact verified completion proof, kept
    as `maintenance_proof` (separate from the reconcile `proof`). A late answer never touches another generation or token."""
    if state not in MAINTENANCE_STATES.get(expected, set()):
        return "refused"
    with _tx(db, None, "maintenance v1 transition") as conn:
        with JOURNAL_LOCK:
            cur = _load(conn)
            _hook("maintenance:transition")
            row = None if cur is None else cur.get(MAINTENANCE_KEY)
            if (cur is None or cur["generation_id"] != generation_id or not isinstance(row, dict) or row.get("token") != token
                    or row.get("state") != expected):
                return STALE
            if state in ("invalidated", "dispatched") and (row.get("witness") is None or not _switch_on(conn)):
                return "refused"
            if state == "dispatched" and _now_ms() >= row["deadline_unix_ms"]:
                return "refused"
            if state == "prepared":
                if not _proof_ok(proof, row, generation_id, token):
                    return "refused"
                cur["maintenance_proof"] = copy.deepcopy(proof)
            row["state"] = state
            _store(conn, cur)
    return state


def _archive_maintenance(cur: dict[str, Any]) -> dict[str, Any]:
    """The prior intent, kept immutable inside the SAME v2 journal value: attempted (dispatched / unknown) stays UNKNOWN, not attempted
    (intent / invalidated) becomes cancelled; terminal ones as they are, with their proof. No counter, no second store, no replay.
    Capacity refuses before loss (ValueError)."""
    history = copy.deepcopy(cur.get("maintenance_history") or {})
    row = cur.get(MAINTENANCE_KEY)
    if isinstance(row, dict):
        row = copy.deepcopy(row)
        if row.get("state") in ("dispatched", "unknown"):
            row["state"] = "unknown"
        elif row.get("state") in ("intent", "invalidated"):
            row["state"] = "cancelled"
        record = {"intent": row, "proof": copy.deepcopy(cur.get("maintenance_proof"))}
        if row["token"] in history and history[row["token"]] != record:
            raise ValueError("maintenance_history_conflict")
        history[row["token"]] = record
    if len(history) > HISTORY_MAX or len(json.dumps(history, sort_keys=True).encode()) > HISTORY_MAX_BYTES:
        raise ValueError("maintenance_history_capacity")
    return history
