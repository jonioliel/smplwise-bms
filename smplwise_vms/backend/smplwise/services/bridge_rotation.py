"""Bridge HMAC key rotation (CR-WISKEY-HMAC-ROTATION-295 section 5): staged rollout with a two-key overlap, write-ahead per step,
automatic rollback, crash recovery. Arx side only; the peer is services/bridge_rotation_peer (UnavailablePeer in this build).

Steps (routine): S1 prepare (K_next derived, sealed, `pending`) -> S2 publish (`begin`, signed with K_cur; the peer proves it derived
K_next) -> S3 confirm (probes under K_next AND K_cur) -> S4 switch (`commit`, signed with K_next; K_next `current`, K_cur `retiring`
until `verify_until`) -> S5 post-switch probe -> S6 retire (at `verify_until`, from `tick`) -> S7 verify (V1c: the old key is gone).
`hard_cut`: no overlap - the old key's verify window ends at the switch and S6 / S7 run in the same request; only a verified hard cut
is `anchor_eligible` (R-25).

Rollback: R1 before the switch (abort under K_cur, K_next discarded; K_cur never touched), R2 when the commit's outcome is unknown
(ask `status`; finish or R1; silent past the cap -> `needs_repair`), R3 when the peer rejects K_next after the switch (abort under
K_cur accepted -> switch back; else `needs_repair`, both keys kept sealed). Every step is committed BEFORE the next peer call, so the
recovery table in `tick` resolves any crash point. One rotation at a time (process lock + partial unique index).

Guards: the switch `bridge.key_rotation` (`on` by default since the activation slice, HMACACT-295; an administrator may turn it off),
the go-live permit, the peer's capability (announced by the bridge in its signed directory push), the system administrator check in
the router. Never logs or audits a key, salt, proof, nonce or signature.

Activation slice (HMACACT-295, owner decision 2026-10-21): the key set is wired into `ha_bridge.sign/verify`; the permit is True in
the SAME commit as that wiring. The FIRST rotation (off the legacy pairing secret) is started by one click of a system administrator (owner
decision 2026-10-21, option A) once the bridge has announced `rotation_v1`; every LATER rotation starts by itself (`worker_pass`, from
`worker_loop`) when the configured reminder interval has passed; nothing starts without the peer's fresh announcement. Answer-binding (H-09): the answer to
`begin` / `abort` must be signed under K_cur, the answers to `commit` / `retire` / the post-switch probes under K_next. Repair (H-05)
aligns Arx to K_next only after a probe under K_next succeeds. Rotation is hygiene, not leak recovery (H-03): suspect a leak -> re-pair."""
from __future__ import annotations

import base64
import hmac
import json
import logging
import secrets
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any, Callable

from ..audit import audit
from ..db import Database, get_setting, new_id, now_iso
from . import bridge_keys as bk
from . import bridge_rotation_peer as peers

log = logging.getLogger("smplwise.bridge_rotation")

# The owner's SEPARATE go-live permit, enforced in code (the capture-lease pattern): while False the switch cannot be set to `on`
# and no rotation starts. Flipped by the activation slice (HMACACT-295): the owner's explicit decision 2026-10-21 (option A, "complete the
# rotation end to end and activate it"), after the Fable security review (docs/security/FABLE_REVIEW_REPORT_2026-10-21.md section 4), in
# the SAME commit that wired the key set into ha_bridge.sign/verify - never in a release of its own.
GO_LIVE_PERMITTED = True

FLAG_KEY = "bridge.key_rotation"
REMINDER_KEY = "bridge.key_rotation.reminder_days"
KEYS = (FLAG_KEY, REMINDER_KEY)
REMINDER_VALUES = (0, 30, 90, 180, 365)
PROTOCOL = "smplwise-bridge-rotation-v1"
MODES = ("routine", "hard_cut")
CAP_S = 180                  # the whole two-key window, from t0 (decision 23)
COMMIT_MIN_REMAINING_S = 100  # the commit is sent only with at least this much budget left (90 s minimum overlap + 10 s)
RETIRE_BY_S = 170            # Arx's retiring window ends at most here (10 s before the peer's cap)
DEFAULT_OVERLAP_S = 90
ACTIVE = ("prepared", "publishing", "published", "confirmed", "switching", "switched", "retiring")
PRE_SWITCH = ("prepared", "publishing", "published", "confirmed")
TERMINAL = ("verified", "verify_failed", "rolled_back", "retired")
OLD_GONE = ("key_retired", "key_unknown", "bad_signature", "key_expired")  # what the peer may answer for a probe under the old key
AUTO_RETRY_S = 3600          # after a failed automatic attempt: wait this long, doubled per consecutive failure (max a day)
AUTO_MAX_WAIT_S = 86400
WORKER_IDLE_S = 60.0
WORKER_BUSY_S = 5.0


class RotationRefused(Exception):
    def __init__(self, code: str, status: int = 409) -> None:
        super().__init__(code)
        self.code = code
        self.status = status


# HMACACT2-295 (CR-034 A1): while a rotation is unfinished, NEW trusted door calls (door_open, door_open_status, the capture-lease
# messages) are refused or held with this reason - a door command is never signed while the key set may be half switched. Held = the
# lease event worker keeps its queue and retries (NotSendable); refused = an interactive door command answers 503
# `bridge_key_rotating` with `outcome: not_sent`. Nothing is dropped silently. `needs_repair` also pauses (the peer's key state is
# unknown) until an administrator resumes it; an administrator turning the switch off lifts the pause (the engine then no longer
# drives a rotation).
PAUSE_STATES = ACTIVE + ("needs_repair",)
PAUSE_CODE = "bridge_key_rotating"
PAUSE_TEXT = "החלפת מפתח הגשר מתבצעת כרגע, ופתיחת דלתות מרחוק מושהית לכמה דקות. לא נשלחה פקודה - אפשר לנסות שוב בעוד רגע."


def door_commands_paused(conn: sqlite3.Connection) -> bool:
    """True while a bridge-key rotation is in progress (or waits for repair) and the rotation switch is on."""
    try:
        if mode(conn) != "on":
            return False
        last = conn.execute("SELECT state FROM bridge_rotations ORDER BY started_at DESC, rowid DESC LIMIT 1").fetchone()
        if last is None:
            return False
        if last["state"] == "needs_repair":
            return True
        return conn.execute(f"SELECT 1 FROM bridge_rotations WHERE state IN ({','.join('?' * len(ACTIVE))}) LIMIT 1", ACTIVE).fetchone() is not None
    except sqlite3.OperationalError:  # no rotation table yet: nothing can be rotating
        return False


def go_live_permitted() -> bool:
    return GO_LIVE_PERMITTED is True


def mode(conn: sqlite3.Connection) -> str:
    """`on` unless an administrator turned it off (activation slice: the default is on - the rotation then needs no manual step)."""
    try:
        return "off" if get_setting(conn, FLAG_KEY) == "off" else "on"
    except sqlite3.Error:
        return "off"


def reminder_days(conn: sqlite3.Connection) -> int:
    try:
        v = int(get_setting(conn, REMINDER_KEY) or "0")
    except (ValueError, sqlite3.Error):
        return 0
    return v if v in REMINDER_VALUES else 0


def peer_available(peer: peers.Peer | None = None) -> bool:
    try:
        return (peer or peers.get_peer()).capabilities().get("rotation") == peers.CAPABILITY
    except Exception:  # noqa: BLE001 - a peer that cannot even answer its capabilities is unavailable
        return False


# a restore asked the engine to treat what it finds as a restore (backup.restore hook; no database work inside the restore)
_RESTORE_SEEN = threading.Event()


def on_restore() -> None:
    _RESTORE_SEEN.set()


_LOCK = threading.Lock()


def rotation_row(conn: sqlite3.Connection, rotation_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT * FROM bridge_rotations WHERE id = ?", (rotation_id,)).fetchone()
    return dict(r) if r else None


def active_row(conn: sqlite3.Connection) -> dict[str, Any] | None:
    try:
        r = conn.execute(f"SELECT * FROM bridge_rotations WHERE state IN ({','.join('?' * len(ACTIVE))}) ORDER BY started_at DESC LIMIT 1", ACTIVE).fetchone()
    except sqlite3.OperationalError:
        return None
    return dict(r) if r else None


def history(conn: sqlite3.Connection, limit: int = 10) -> list[dict[str, Any]]:
    try:
        rs = conn.execute("SELECT * FROM bridge_rotations ORDER BY started_at DESC, rowid DESC LIMIT ?", (limit,)).fetchall()
    except sqlite3.OperationalError:
        return []
    return [public(dict(r)) for r in rs]


def public(row: dict[str, Any]) -> dict[str, Any]:
    """A rotation for the screen: ids, states, codes and times (steps keep their codes only)."""
    try:
        steps = json.loads(row.get("steps_json") or "[]")
    except ValueError:
        steps = []
    return {k: row.get(k) for k in ("id", "mode", "state", "kid_from", "kid_to", "gen_from", "gen_to", "overlap_s", "started_at", "t0_at",
                                    "switched_at", "ended_at", "result_code", "peer_retire_ok")} | {
        "anchor_eligible": bool(row.get("anchor_eligible")), "steps": steps if isinstance(steps, list) else []}


class Engine:
    """One engine per call site (router, tests). `now` is the wall clock (injectable for fake time)."""

    def __init__(self, db: Database, data_dir: Path, peer: peers.Peer | None = None, now: Callable[[], float] = time.time,
                 settings: Any = None) -> None:
        self.db = db
        self.data_dir = data_dir
        self.peer = peer or peers.get_peer(db, settings)
        self.now = now
        self.actor: Any = None
        self.automatic = False  # started by the worker (audited as such), not by an administrator

    # ------------------------------------------------------------ persistence helpers

    def _audit(self, conn: sqlite3.Connection, action: str, decision: str, rot: dict[str, Any] | None, *, reason: str | None = None,
               step: str | None = None) -> None:
        details: dict[str, Any] = {}
        if rot:
            details = {k: rot.get(k) for k in ("mode", "kid_from", "kid_to", "gen_from", "gen_to")}
        if step:
            details["step"] = step
        audit(conn, actor=self.actor, action=action, decision=decision, resource_type="bridge_rotation",
              resource_id=(rot or {}).get("id") or "*", reason=reason, details=details)

    def _step(self, conn: sqlite3.Connection, rot: dict[str, Any], state: str, step: str, ok: bool = True, code: str | None = None,
              **cols: Any) -> dict[str, Any]:
        try:
            steps = json.loads(rot.get("steps_json") or "[]")
        except ValueError:
            steps = []
        steps.append({"step": step, "ok": ok, "code": code, "at": now_iso()})
        sets = {"state": state, "steps_json": json.dumps(steps), **cols}
        conn.execute(f"UPDATE bridge_rotations SET {', '.join(f'{k} = ?' for k in sets)} WHERE id = ?", (*sets.values(), rot["id"]))
        return rotation_row(conn, rot["id"]) or rot

    def _call(self, op: str, kid: str, material: str, rot: dict[str, Any], expect: tuple[str, ...] | None = None, unsigned_refusal_ok: bool = False, **fields: Any) -> dict[str, Any]:
        """Sign one control message and verify the peer's answer. Raises PeerUnreachable (no answer) or returns the answer, with
        `ok` False and a closed `code` for a refusal and `peer_bad_answer` for an answer that does not verify / bind. `expect` (H-09)
        names the keys the answer may be signed with - `begin` / `abort` / the pre-switch probes under K_cur, `commit` / `retire` and
        the post-switch probes under K_next; without it either of the rotation's two keys is accepted (`status`). The answer carries
        `signed_by` (the kid it verified under)."""
        body = {"protocol": PROTOCOL, "op": op, "rotation_id": rot["id"], **fields}
        msg = bk.sign_with(kid, material, body, ts=int(self.now()))
        answer = self.peer.call(op, msg)
        if not isinstance(answer, dict):
            return {"ok": False, "code": "peer_bad_answer"}
        try:
            with self.db.connection(mode="read") as conn:
                signed_by = bk.verify(conn, self.data_dir, answer, now=self.now())
        except bk.VerifyError:
            # HA-01: the bridge answers a message that did not verify with an UNSIGNED refusal. For the one probe whose whole point is that the old
            # key no longer verifies (V1c), that refusal is the expected answer; everywhere else an unsigned answer is a bad answer
            code = answer.get("code")
            if (unsigned_refusal_ok and answer.get("ok") is False and "sig" not in answer and isinstance(code, str) and code in OLD_GONE):
                return {"ok": False, "code": code, "unsigned": True}
            return {"ok": False, "code": "peer_bad_answer"}
        if answer.get("protocol") != PROTOCOL or answer.get("op") != op or answer.get("rotation_id") != rot["id"] or answer.get("reply_to") != msg["nonce"]:
            return {"ok": False, "code": "peer_bad_answer"}
        # H-09 binds a SUCCESS: only an answer that says `ok` can switch, wipe or align anything, so only that one must come from the
        # key the step's phase calls for. A refusal under either of the rotation's keys just rolls the step back.
        if signed_by not in ((expect or (rot["kid_from"], rot["kid_to"])) if answer.get("ok") is True else (rot["kid_from"], rot["kid_to"])):
            return {"ok": False, "code": "peer_bad_answer"}
        if answer.get("ok") is not True:
            code = answer.get("code")
            return {**answer, "ok": False, "code": code if isinstance(code, str) and code.isidentifier() and len(code) <= 40 else "peer_rejected", "signed_by": signed_by}
        return {**answer, "signed_by": signed_by}

    def _material(self, kid: str) -> str | None:
        with self.db.connection(mode="read") as conn:
            try:
                key = bk.load(conn, self.data_dir, kid)
            except bk.KeySetError:
                return None
        return key.material if key else None

    # ------------------------------------------------------------ start

    def preflight(self, conn: sqlite3.Connection) -> None:
        if mode(conn) != "on":
            raise RotationRefused("rotation_off")
        if not go_live_permitted():
            raise RotationRefused("rotation_not_permitted")
        if not peer_available(self.peer):
            raise RotationRefused("peer_unavailable")
        if active_row(conn) is not None:
            raise RotationRefused("rotation_in_progress")
        last = conn.execute("SELECT state FROM bridge_rotations ORDER BY started_at DESC, rowid DESC LIMIT 1").fetchone()
        if last is not None and last["state"] == "needs_repair":
            raise RotationRefused("repair_required")

    def start(self, actor: Any, rotation_mode: str, overlap_s: int = DEFAULT_OVERLAP_S) -> dict[str, Any]:
        if rotation_mode not in MODES:
            raise RotationRefused("validation", 422)
        overlap_s = 0 if rotation_mode == "hard_cut" else int(overlap_s)
        if not 0 <= overlap_s <= 120:
            raise RotationRefused("validation", 422)
        self.actor = actor
        if not _LOCK.acquire(blocking=False):
            raise RotationRefused("rotation_in_progress")
        try:
            return self._start(rotation_mode, overlap_s)
        finally:
            _LOCK.release()

    def _start(self, rotation_mode: str, overlap_s: int) -> dict[str, Any]:
        salt = secrets.token_bytes(32)
        # S0 + S1 in one write transaction: preflight, adopt the legacy key if needed, derive and seal K_next
        with self.db.write_aside() as conn:
            self.preflight(conn)
            try:
                cur = bk.adopt_legacy(conn, self.data_dir) if not bk.adopted(conn) else bk.current(conn, self.data_dir)
            except bk.KeySetError as exc:
                raise RotationRefused(exc.code) from None
            if cur.kid == bk.LEGACY_KID and conn.execute("SELECT COUNT(*) FROM bridge_rotations").fetchone()[0] == 0:
                audit(conn, actor=self.actor, action="bridge.key.adopted", decision="allowed", resource_type="bridge_key", resource_id=cur.kid,
                      details={"generation": 0})
            assert cur.material is not None
            gen_next = (conn.execute("SELECT MAX(generation) FROM bridge_keys").fetchone()[0] or 0) + 1
            kid_next = bk.new_kid(gen_next)
            rot_id = new_id()
            conn.execute("INSERT INTO bridge_rotations(id, mode, state, kid_from, kid_to, gen_from, gen_to, overlap_s, started_by, started_at) "
                         "VALUES (?, ?, 'prepared', ?, ?, ?, ?, ?, ?, ?)",
                         (rot_id, rotation_mode, cur.kid, kid_next, cur.generation, gen_next, overlap_s, getattr(self.actor, "user_id", None), now_iso()))
            bk.insert(conn, self.data_dir, kid=kid_next, generation=gen_next, state="pending",
                      material=bk.derive_next(cur.material, salt, kid_next, gen_next), rotation_id=rot_id)
            rot = rotation_row(conn, rot_id)
            assert rot is not None
            rot = self._step(conn, rot, "prepared", "prepare")
            self._audit(conn, "bridge.rotation.requested", "allowed", rot, reason="automatic" if self.automatic else None)
            self._audit(conn, "bridge.rotation.prepared", "allowed", rot, step="prepare")
        return self._publish(rot, salt)

    # ------------------------------------------------------------ S2 .. S5

    def _publish(self, rot: dict[str, Any], salt: bytes) -> dict[str, Any]:
        t0 = self.now()
        with self.db.write_aside() as conn:
            rot = self._step(conn, rot, "publishing", "publish_sent", t0_at=bk.iso_at(t0))
        cur_m, next_m = self._material(rot["kid_from"]), self._material(rot["kid_to"])
        if cur_m is None or next_m is None:
            return self._rollback(rot, "key_unreadable")
        try:
            ans = self._call("begin", rot["kid_from"], cur_m, rot, expect=(rot["kid_from"],), kid_next=rot["kid_to"], gen_next=rot["gen_to"],
                             salt=base64.b64encode(salt).decode("ascii"), overlap_s=rot["overlap_s"], mode=rot["mode"])
        except peers.PeerUnreachable:
            return self._rollback(rot, "peer_unreachable")
        if not ans["ok"]:
            return self._rollback(rot, ans["code"])
        got = ans.get("proof")
        if not isinstance(got, str) or not hmac.compare_digest(got, bk.proof(next_m, rot["id"])):
            return self._rollback(rot, "derivation_mismatch")
        with self.db.write_aside() as conn:
            bk.set_state(conn, rot["kid_to"], "next")
            rot = self._step(conn, rot, "published", "publish")
            self._audit(conn, "bridge.rotation.published", "allowed", rot, step="publish")
        return self._confirm(rot)

    def _probe(self, rot: dict[str, Any], kid: str, material: str, answered_by: str | None = None, unsigned_refusal_ok: bool = False) -> tuple[bool, str | None]:
        """A probe signed with `kid`. `answered_by` (H-09) is the key the peer must answer with: K_cur before the switch, K_next after it."""
        try:
            ans = self._call("probe", kid, material, rot, expect=(answered_by,) if answered_by else None, unsigned_refusal_ok=unsigned_refusal_ok)
        except peers.PeerUnreachable:
            return False, "peer_unreachable"
        return (True, None) if ans["ok"] else (False, ans["code"])

    def _confirm(self, rot: dict[str, Any]) -> dict[str, Any]:
        cur_m, next_m = self._material(rot["kid_from"]), self._material(rot["kid_to"])
        if cur_m is None or next_m is None:
            return self._rollback(rot, "key_unreadable")
        ok, code = self._probe(rot, rot["kid_to"], next_m, rot["kid_from"])
        if not ok:
            return self._rollback(rot, f"probe_next_failed:{code}")
        ok, code = self._probe(rot, rot["kid_from"], cur_m, rot["kid_from"])
        if not ok:
            return self._rollback(rot, f"probe_current_failed:{code}")
        with self.db.write_aside() as conn:
            rot = self._step(conn, rot, "confirmed", "confirm")
            self._audit(conn, "bridge.rotation.confirmed", "allowed", rot, step="confirm")
        return self._switch(rot)

    def _budget_left(self, rot: dict[str, Any]) -> float:
        t0 = bk.epoch_of(rot.get("t0_at"))
        return -1.0 if t0 is None else t0 + CAP_S - self.now()

    def _switch(self, rot: dict[str, Any]) -> dict[str, Any]:
        if self._budget_left(rot) < COMMIT_MIN_REMAINING_S:
            return self._rollback(rot, "budget_exceeded")
        next_m = self._material(rot["kid_to"])
        if next_m is None:
            return self._rollback(rot, "key_unreadable")
        with self.db.write_aside() as conn:
            rot = self._step(conn, rot, "switching", "commit_sent")
        try:
            ans = self._call("commit", rot["kid_to"], next_m, rot, expect=(rot["kid_to"],))
        except peers.PeerUnreachable:
            return self._unknown_commit(rot)
        if not ans["ok"]:
            if ans["code"] == "peer_bad_answer":
                return self._unknown_commit(rot)  # an answer we cannot trust says nothing about the outcome
            return self._rollback(rot, f"commit_rejected:{ans['code']}")
        rot = self._finish_switch(rot)
        return self._after_switch(rot)

    def _finish_switch(self, rot: dict[str, Any]) -> dict[str, Any]:
        """One transaction: K_next current, K_cur retiring until `verify_until` (hard cut: until now - Arx refuses it at once)."""
        now = self.now()
        t0 = bk.epoch_of(rot.get("t0_at")) or now
        until = now if rot["mode"] == "hard_cut" else min(now + rot["overlap_s"], t0 + RETIRE_BY_S)
        with self.db.write_aside() as conn:
            bk.set_state(conn, rot["kid_from"], "retiring", verify_until=bk.iso_at(until))
            bk.set_state(conn, rot["kid_to"], "current")
            rot = self._step(conn, rot, "switched", "switch", switched_at=now_iso())
            self._audit(conn, "bridge.rotation.switched", "allowed", rot, step="switch")
        # CR-WISKEY-LEASE-REVOCATION-EVENT T9: a key rotation revokes every capture lease and resets the revocation stream
        from . import capture_lease, lease_events

        capture_lease.on_authority_change("key_rotation", all=True)
        lease_events.WORKER.request_reset("key_rotation")
        return rot

    def _after_switch(self, rot: dict[str, Any]) -> dict[str, Any]:
        next_m = self._material(rot["kid_to"])
        ok, code = (False, "key_unreadable") if next_m is None else self._probe(rot, rot["kid_to"], next_m, rot["kid_to"])
        if not ok:
            return self._switch_back(rot, f"post_switch_probe_failed:{code}")
        if rot["mode"] == "hard_cut":
            return self._retire(rot)
        return rot

    # ------------------------------------------------------------ S6 / S7

    def _retire(self, rot: dict[str, Any]) -> dict[str, Any]:
        old_m = self._material(rot["kid_from"])  # hard cut: kept in memory for V1c only; routine: the window has ended anyway
        with self.db.write_aside() as conn:
            rot = self._step(conn, rot, "retiring", "retire_sent")
        cur_m = self._material(rot["kid_to"])
        peer_ok = False
        if cur_m is not None:
            try:
                peer_ok = self._call("retire", rot["kid_to"], cur_m, rot, expect=(rot["kid_to"],))["ok"]
            except peers.PeerUnreachable:
                peer_ok = False
        with self.db.write_aside() as conn:
            bk.set_state(conn, rot["kid_from"], "retired")  # wiped whatever the peer said: Arx no longer verifies it
            rot = self._step(conn, rot, "retired", "retire", ok=peer_ok, code=None if peer_ok else "peer_retire_unconfirmed",
                             peer_retire_ok=1 if peer_ok else 0)
            self._audit(conn, "bridge.rotation.retired", "allowed", rot, step="retire", reason=None if peer_ok else "peer_retire_unconfirmed")
        bk.scrub(self.db)  # H-07: the wiped blob does not stay in the write-ahead log
        return self._verify(rot, old_m)

    def _verify(self, rot: dict[str, Any], old_material: str | None) -> dict[str, Any]:
        cur_m = self._material(rot["kid_to"])
        ok_new, code_new = (False, "key_unreadable") if cur_m is None else self._probe(rot, rot["kid_to"], cur_m, rot["kid_to"])
        old_rejected: bool
        if old_material is not None and rot["mode"] == "hard_cut":
            ok_old, code_old = self._probe(rot, rot["kid_from"], old_material, rot["kid_to"], unsigned_refusal_ok=True)
            old_rejected = (not ok_old) and code_old in OLD_GONE
        else:
            try:
                st = self._call("status", rot["kid_to"], cur_m, rot, expect=(rot["kid_to"],)) if cur_m else {"ok": False}
            except peers.PeerUnreachable:
                st = {"ok": False}
            old_rejected = st.get("ok") is True and st.get("old_key_present") is False and st.get("active_kid") == rot["kid_to"]
        del old_material
        good = ok_new and old_rejected
        eligible = 1 if (good and rot["mode"] == "hard_cut") else 0
        with self.db.write_aside() as conn:
            rot = self._step(conn, rot, "verified" if good else "verify_failed", "verify", ok=good,
                             code=None if good else (code_new if not ok_new else "old_key_not_rejected"), ended_at=now_iso(), anchor_eligible=eligible,
                             result_code=None if good else (code_new if not ok_new else "old_key_not_rejected"))
            self._audit(conn, "bridge.rotation.verified" if good else "bridge.rotation.failed", "allowed" if good else "denied", rot, step="verify",
                        reason=None if good else rot["result_code"])
        return rot

    # ------------------------------------------------------------ rollback

    def _rollback(self, rot: dict[str, Any], code: str) -> dict[str, Any]:
        """R1: before the switch. K_cur was never touched; K_next is discarded (wiped)."""
        cur_m = self._material(rot["kid_from"])
        if cur_m is not None:
            try:
                self._call("abort", rot["kid_from"], cur_m, rot, expect=(rot["kid_from"],))
            except peers.PeerUnreachable:
                pass  # the peer's own cap discards `next`
        with self.db.write_aside() as conn:
            k = conn.execute("SELECT state FROM bridge_keys WHERE kid = ?", (rot["kid_to"],)).fetchone()
            if k is not None and k["state"] in ("pending", "next"):
                bk.set_state(conn, rot["kid_to"], "discarded")
            rot = rotation_row(conn, rot["id"]) or rot
            rot = self._step(conn, rot, "rolled_back", "rollback", ok=False, code=code, ended_at=now_iso(), result_code=code)
            self._audit(conn, "bridge.rotation.rolled_back", "denied", rot, step="rollback", reason=code)
        bk.scrub(self.db)
        return rot

    def _unknown_commit(self, rot: dict[str, Any]) -> dict[str, Any]:
        """R2: the commit's outcome is unknown. Ask the peer (under K_cur, which it verifies until its cap)."""
        cur_m = self._material(rot["kid_from"])
        st: dict[str, Any] = {"ok": False}
        if cur_m is not None:
            try:
                st = self._call("status", rot["kid_from"], cur_m, rot)
            except peers.PeerUnreachable:
                st = {"ok": False, "code": "peer_unreachable"}
        # H-09: a peer that committed signs with K_next, one that did not signs with K_cur - a claim signed under the other key is not believed
        if st.get("ok") is True and (st.get("rotation") == "committed") != (st.get("signed_by") == rot["kid_to"]):
            st = {"ok": False, "code": "peer_bad_answer"}
        if st.get("ok") is True and st.get("rotation") == "committed":
            rot = self._finish_switch(rot)
            with self.db.write_aside() as conn:
                self._audit(conn, "bridge.rotation.recovered", "allowed", rot, step="status_committed")
            return self._after_switch(rot)
        if st.get("ok") is True and st.get("rotation") in ("not_committed", "unknown_rotation", "aborted"):
            return self._rollback(rot, "commit_not_applied")
        if self._budget_left(rot) < 0:
            with self.db.write_aside() as conn:
                rot = self._step(conn, rot, "needs_repair", "status", ok=False, code="commit_outcome_unknown", ended_at=now_iso(),
                                 result_code="commit_outcome_unknown")
                self._audit(conn, "bridge.rotation.needs_repair", "denied", rot, step="status", reason="commit_outcome_unknown")
        return rot  # still `switching`: retried by tick / resume; both keys stay sealed

    def _switch_back(self, rot: dict[str, Any], code: str) -> dict[str, Any]:
        """R3: the peer rejects K_next after the switch. Only an abort the peer accepts under K_cur lets Arx switch back."""
        cur_m = self._material(rot["kid_from"])
        accepted = False
        if cur_m is not None:
            try:
                accepted = self._call("abort", rot["kid_from"], cur_m, rot, expect=(rot["kid_from"],))["ok"]
            except peers.PeerUnreachable:
                accepted = False
        with self.db.write_aside() as conn:
            if accepted:
                bk.set_state(conn, rot["kid_to"], "discarded")
                bk.set_state(conn, rot["kid_from"], "current")
                rot = self._step(conn, rot, "rolled_back", "switch_back", ok=False, code=code, ended_at=now_iso(), result_code=code)
                self._audit(conn, "bridge.rotation.rolled_back", "denied", rot, step="switch_back", reason=code)
            else:
                rot = self._step(conn, rot, "needs_repair", "switch_back", ok=False, code=code, ended_at=now_iso(), result_code=code)
                self._audit(conn, "bridge.rotation.needs_repair", "denied", rot, step="switch_back", reason=code)
        bk.scrub(self.db)
        return rot

    # ------------------------------------------------------------ tick / resume (recovery table, design 5.3)

    def tick(self) -> dict[str, Any] | None:
        """Drive the active rotation one round. Never starts a rotation. Returns the rotation it acted on (or None)."""
        if not _LOCK.acquire(blocking=False):
            return None  # a start (or another tick) is running in this process
        try:
            with self.db.connection(mode="read") as conn:
                rot = active_row(conn)
            restored = _RESTORE_SEEN.is_set()
            _RESTORE_SEEN.clear()
            if rot is None:
                return None
            state = rot["state"]
            if state in PRE_SWITCH:
                return self._rollback(rot, "restore" if restored else "interrupted")
            if state == "switching":
                return self._unknown_commit(rot)
            if state == "switched":
                with self.db.connection(mode="read") as conn:
                    k = conn.execute("SELECT verify_until FROM bridge_keys WHERE kid = ?", (rot["kid_from"],)).fetchone()
                until = bk.epoch_of(k["verify_until"]) if k else None
                if until is None or self.now() >= until:
                    return self._retire(rot)
                return rot
            if state == "retiring":
                return self._retire(rot)
            return rot
        finally:
            _LOCK.release()

    def resume(self, rotation_id: str) -> dict[str, Any]:
        with self.db.connection(mode="read") as conn:
            rot = rotation_row(conn, rotation_id)
        if rot is None:
            raise RotationRefused("not_found", 404)
        if rot["state"] == "needs_repair":
            return self._repair(rot)
        return self.tick() or rot

    def _repair(self, rot: dict[str, Any]) -> dict[str, Any]:
        """Ask the peer which key it signs with now (under the key Arx signs with) and align Arx with it."""
        if not _LOCK.acquire(blocking=False):
            raise RotationRefused("rotation_in_progress")
        try:
            with self.db.connection(mode="read") as conn:
                try:
                    cur = bk.current(conn, self.data_dir)
                except bk.KeySetError as exc:
                    raise RotationRefused(exc.code) from None
            assert cur.material is not None
            try:
                st = self._call("status", cur.kid, cur.material, rot)
            except peers.PeerUnreachable:
                return rot
            if st.get("ok") is not True:
                return rot
            active = st.get("active_kid")
            if active not in (rot["kid_from"], rot["kid_to"]) or st.get("signed_by") != active:  # a peer signs with the key it says it signs with
                return rot
            if active == rot["kid_to"]:
                # H-05: the peer's word is not enough to retire K_cur - the peer must also ANSWER a probe signed with K_next, under K_next
                next_m = cur.material if cur.kid == rot["kid_to"] else self._material(rot["kid_to"])
                if next_m is None:
                    return rot
                try:
                    ok, _code = self._probe(rot, rot["kid_to"], next_m, rot["kid_to"])
                except peers.PeerUnreachable:
                    ok = False
                if not ok:
                    return rot
            with self.db.write_aside() as conn:
                if active == rot["kid_to"]:
                    if cur.kid != rot["kid_to"]:
                        bk.set_state(conn, rot["kid_from"], "retired")
                        bk.set_state(conn, rot["kid_to"], "current")
                    else:
                        bk.set_state(conn, rot["kid_from"], "retired")
                    rot = self._step(conn, rot, "retired", "repair", ok=True, code="aligned_to_next", result_code="aligned_to_next",
                                     peer_retire_ok=1 if st.get("old_key_present") is False else 0)
                elif active == rot["kid_from"]:
                    if cur.kid != rot["kid_from"]:
                        bk.set_state(conn, rot["kid_to"], "discarded")
                        bk.set_state(conn, rot["kid_from"], "current")
                    else:
                        bk.set_state(conn, rot["kid_to"], "discarded")
                    rot = self._step(conn, rot, "rolled_back", "repair", ok=True, code="aligned_to_current", result_code="aligned_to_current")
                else:
                    return rot
                self._audit(conn, "bridge.rotation.recovered", "allowed", rot, step="repair", reason=rot["result_code"])
            bk.scrub(self.db)
            return rot
        finally:
            _LOCK.release()


def reminder_due(conn: sqlite3.Connection, now: float | None = None) -> bool:
    days = reminder_days(conn)
    if not days:
        return False
    r = conn.execute("SELECT activated_at, created_at FROM bridge_keys WHERE state = 'current'").fetchone() if _has_tables(conn) else None
    since = bk.epoch_of((r["activated_at"] or r["created_at"]) if r else None)
    if since is None:
        return False
    return ((now if now is not None else time.time()) - since) >= days * 86400


def _has_tables(conn: sqlite3.Connection) -> bool:
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'bridge_keys'").fetchone() is not None


def view(conn: sqlite3.Connection, data_dir: Path, peer: peers.Peer | None = None) -> dict[str, Any]:
    keys = bk.status(conn, data_dir)
    active = active_row(conn)
    hist = history(conn)
    last = hist[0] if hist else None
    available = peer_available(peer)
    blocked = None
    if mode(conn) != "on":
        blocked = "rotation_off"
    elif not go_live_permitted():
        blocked = "rotation_not_permitted"
    elif not available:
        blocked = "peer_unavailable"
    elif active is not None:
        blocked = "rotation_in_progress"
    elif last is not None and last["state"] == "needs_repair":
        blocked = "repair_required"
    elif keys["current"] is not None and not keys["current"]["readable"]:
        blocked = "key_unreadable"
    elif keys["current"] is None and not get_setting(conn, "bridge.secret"):
        blocked = "not_paired"
    retire_at = None
    if active is not None and active["state"] == "switched":
        for k in keys["keys"]:
            if k["kid"] == active["kid_from"]:
                retire_at = k["verify_until"]
    return {
        "enabled": mode(conn) == "on",
        "go_live_permitted": go_live_permitted(),
        "peer_available": available,
        "adopted": keys["current"] is not None,
        "key": keys["current"],
        "keys": keys["keys"],
        "rotation": (public(active) | {"retire_at": retire_at}) if active else None,
        "last": last,
        "history": hist,
        "reminder_days": reminder_days(conn),
        "reminder_values": list(REMINDER_VALUES),
        "reminder_due": reminder_due(conn),
        "can_start": blocked is None,
        "blocked_by": blocked,
        "automatic": automatic_state(conn, available),
    }


# ---------------------------------------------------------------- automatic start and the worker (HMACACT-295)

def automatic_state(conn: sqlite3.Connection, available: bool) -> str:
    """For the card: `waiting_for_bridge` (the bridge has not announced support - it needs the update), `scheduled` (will start by itself),
    `awaiting_click` (the bridge is ready; the FIRST rotation needs one click of a system administrator), `idle` (nothing to do until the
    reminder interval), `off` (switch off)."""
    if mode(conn) != "on" or not go_live_permitted():
        return "off"
    if not available:
        return "waiting_for_bridge"
    if first_rotation_pending(conn):
        return "awaiting_click"
    return "scheduled" if auto_wanted(conn) else "idle"


def first_rotation_pending(conn: sqlite3.Connection) -> bool:
    """The channel still runs on the legacy pairing secret: the first rotation (which retires it) is the administrator's click (owner decision 2026-10-21)."""
    if not _has_tables(conn):
        return False
    cur = conn.execute("SELECT kid FROM bridge_keys WHERE state = 'current'").fetchone()
    if cur is None:
        return bool(get_setting(conn, "bridge.secret")) and bool(get_setting(conn, "bridge.paired_at"))
    return cur["kid"] == bk.LEGACY_KID


def auto_wanted(conn: sqlite3.Connection, now: float | None = None) -> bool:
    """Whether the WORKER should start a rotation now: only a LATER rotation - the configured reminder interval has passed. The first rotation
    (the channel still on the legacy pairing secret) is never started by the worker: it needs the administrator's click. Says nothing about
    the guards (`auto_due` has them)."""
    if not _has_tables(conn) or first_rotation_pending(conn):
        return False
    return reminder_due(conn, now)


def _backoff_s(conn: sqlite3.Connection) -> tuple[float, float | None]:
    """(wait, since): after consecutive failed rotations (rolled back / verify failed) wait AUTO_RETRY_S * 2^(n-1), at most a day."""
    n, since = 0, None
    for r in conn.execute("SELECT state, COALESCE(ended_at, started_at) AS at FROM bridge_rotations ORDER BY started_at DESC, rowid DESC LIMIT 8").fetchall():
        if r["state"] in ("rolled_back", "verify_failed"):
            n += 1
            since = since or bk.epoch_of(r["at"])
        else:
            break
    if n == 0:
        return 0.0, None
    return min(AUTO_MAX_WAIT_S, AUTO_RETRY_S * (2 ** (n - 1))), since


def auto_due(conn: sqlite3.Connection, peer: peers.Peer, now: float) -> bool:
    if mode(conn) != "on" or not go_live_permitted() or not peer_available(peer) or not auto_wanted(conn, now):
        return False
    if active_row(conn) is not None:
        return False
    last = conn.execute("SELECT state FROM bridge_rotations ORDER BY started_at DESC, rowid DESC LIMIT 1").fetchone()
    if last is not None and last["state"] == "needs_repair":
        return False
    wait, since = _backoff_s(conn)
    return not (wait and since is not None and now - since < wait)


def worker_pass(db: Database, settings: Any, peer: peers.Peer | None = None, now: Callable[[], float] = time.time) -> dict[str, Any] | None:
    """One round of the background worker: drive an unfinished rotation (retire at the deadline, recover a crash), else start the automatic
    rotation when it is due. Returns the rotation it acted on. Never raises."""
    engine = Engine(db, settings.data_dir, peer, now=now, settings=settings)
    try:
        acted = engine.tick()
        if acted is not None:
            return acted
        with db.connection(mode="read") as conn:
            due = auto_due(conn, engine.peer, now())
        if not due:
            return None
        engine.automatic = True
        return engine.start(None, "routine")
    except RotationRefused:
        return None
    except Exception:  # noqa: BLE001 - a worker pass never takes the process down; the next pass looks again
        log.warning("bridge key rotation worker pass failed", exc_info=True)
        return None


async def worker_loop(db: Database, settings: Any, first_delay_s: float = 45.0) -> None:
    import asyncio

    from starlette.concurrency import run_in_threadpool

    await asyncio.sleep(first_delay_s)
    while True:
        busy = False
        try:
            await run_in_threadpool(worker_pass, db, settings)
            with db.connection(mode="read") as conn:
                busy = active_row(conn) is not None
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            log.warning("bridge key rotation worker failed", exc_info=True)
        await asyncio.sleep(WORKER_BUSY_S if busy else WORKER_IDLE_S)
