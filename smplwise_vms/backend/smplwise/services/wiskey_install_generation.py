"""WISKEY-R2-ALIGN-2272: the installation generation journal (semantic adoption of WisKey R2 `installation_generation`, with the
finding WIN-R2-ARX-GEN-01 fixed in Arx's own code - docs/changes/WISKEY-R2-ALIGN-2272.md).

One journal document per Arx install (setting `wiskey.installation.generation`, never in a backup: prefix `wiskey.installation.`):
{generation_id, digest, state, claim, proof, updated}. A generation is one staged source digest. Rules:

* every read-modify-write runs under ONE shared process lock AND inside a write transaction (BEGIN IMMEDIATE), so a read and the write
  that follows it can not be separated by another thread or process;
* every update is a compare-and-set on (generation_id, expected state, claim token); a mismatch changes nothing and says `stale`;
* the lock is released BEFORE any outside I/O (platform restart call, WisKey registry read); the outcome is applied afterwards by a
  fresh CAS, so a late result of generation A can never mark or overwrite generation B;
* nothing here has an effect by itself: callers are behind `wiskey.auto_install` (default OFF).
"""
from __future__ import annotations

import json
import threading
import time
import uuid
from contextlib import contextmanager
from typing import Any, Callable, Iterator

GENERATION_KEY = "wiskey.installation.generation"
RESTART_DIGEST_KEY = "wiskey.installation.restart_digest"  # kept in step with the journal (older readers / tests)

STAGED, CLAIMED, REQUESTED, UNKNOWN = "staged", "restart_claimed", "restart_requested", "restart_unknown"
STALE = "stale"

JOURNAL_LOCK = threading.RLock()  # the one shared lock of every journal read-modify-write
_test_hook: Callable[[str], None] | None = None  # tests only: called inside the critical section, never set in production


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
    return doc if isinstance(doc, dict) and isinstance(doc.get("generation_id"), str) else None


def _store(conn: Any, doc: dict[str, Any]) -> None:
    from ..db import set_setting

    doc["updated"] = round(time.time(), 3)
    set_setting(conn, GENERATION_KEY, json.dumps(doc, sort_keys=True, separators=(",", ":")))


def read(db: Any, conn: Any = None) -> dict[str, Any] | None:
    if conn is not None:
        return _load(conn)
    with db.connection(mode="read", label="wiskey generation read") as c:
        return _load(c)


def begin(db: Any, conn: Any, digest: str) -> str:
    """The generation for this staged digest: the current one when its digest is the same, otherwise a NEW generation (state `staged`)
    that supersedes the old one. A legacy restart claim for the same digest (setting only, no journal) is carried over as claimed."""
    from ..db import get_setting

    with JOURNAL_LOCK:
        with _tx(db, conn, "wiskey generation begin") as c:
            cur = _load(c)
            _hook("begin:read")
            if cur is not None and cur.get("digest") == digest:
                return str(cur["generation_id"])
            doc: dict[str, Any] = {"generation_id": uuid.uuid4().hex, "digest": digest, "state": STAGED, "claim": None, "proof": None}
            if get_setting(c, RESTART_DIGEST_KEY) == digest:
                doc.update(state=UNKNOWN, claim="legacy")
            _store(c, doc)
            return str(doc["generation_id"])


def claim_restart(db: Any, conn: Any, generation_id: str, digest: str) -> str | None:
    """CAS `staged -> restart_claimed` for exactly this generation and digest. Returns the claim token, or None when the generation is
    not current, is not `staged`, or the digest was already claimed (so two requests can never both go out)."""
    from ..db import set_setting

    with JOURNAL_LOCK:
        with _tx(db, conn, "wiskey generation claim") as c:
            cur = _load(c)
            _hook("claim:read")
            if cur is None or cur.get("generation_id") != generation_id or cur.get("digest") != digest or cur.get("state") != STAGED:
                return None
            token = uuid.uuid4().hex
            cur.update(state=CLAIMED, claim=token)
            _store(c, cur)
            set_setting(c, RESTART_DIGEST_KEY, digest)
            return token


def finish_restart(db: Any, conn: Any, generation_id: str, claim: str, ok: bool) -> str:
    """Apply the outcome of the restart call (made OUTSIDE the lock) by CAS on (generation, claim, state `restart_claimed`).
    A superseded generation or a foreign claim returns `stale` and writes nothing."""
    with JOURNAL_LOCK:
        with _tx(db, conn, "wiskey generation finish") as c:
            cur = _load(c)
            _hook("finish:read")
            if cur is None or cur.get("generation_id") != generation_id or cur.get("claim") != claim or cur.get("state") != CLAIMED:
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
    with JOURNAL_LOCK:
        with _tx(db, None, "wiskey generation proof") as c:
            cur = _load(c)
            _hook("proof:read")
            if cur is None or cur.get("generation_id") != generation_id:
                return STALE
            cur["proof"] = {"intent": intent, "outcome": outcome, "at": round(time.time(), 3)}
            _store(c, cur)
            return "recorded"
