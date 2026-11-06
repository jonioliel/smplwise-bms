"""The bridge-key watchdog (WXH-LEFTOVERS-2405; CR-034 sections 3, 12 and slice H5): it REPORTS bridge-key conditions that already fail
closed. It never starts, resumes, aborts or repairs a rotation, never calls the bridge, never touches a key, and never names or sends a door,
lock or door-program command (the name keeps this module under SR-1's timer-shaped rule: tests/test_fake_doorwin_closed_rule_sr1.py).

Conditions (`conditions`, read only):
- `overlap_overdue`: a rotation is still unfinished more than CAP_S + GRACE_S after it began (its publish, else its start). The two-key window
  is capped at 180 s on both sides, so by then Arx already refuses the old key (`key_expired`) and the peer's own cap has ended its window;
  the report says the rotation did not finish (the worker could not drive it - a crash, a lost bridge, the switch turned off mid-way).
- `needs_repair`: the latest rotation waits for an administrator (the commit's outcome stayed unknown past the cap). While the rotation
  switch is on, remote door commands are paused by HMACACT2-295 until it is resolved.
- `verify_failed`: the latest rotation could not prove that the bridge dropped the old key (V1). Keys stay as they are.
- `generation_mismatch`: a VERIFIED directory push from the bridge reported a key generation other than Arx's current one while no rotation
  is running (`bridge_rotation_peer.reported_key_generation`; a bridge that reports none is never a mismatch).

`check(db)` runs once per worker round (services/bridge_rotation.worker_pass, after the engine's own round) and turns each NEW condition into
one audit row (`bridge.rotation.overlap_overdue` for that condition, `bridge.key.watchdog` for the others) and one notice to the owner
contacts and the system administrators (services/bridge_key_notice); a condition that ended resolves its notice and is audited as cleared.
What was reported lives in the setting `bridge.watchdog` (backup.SETTINGS_KEEP), so a restart does not repeat a report.
"""
from __future__ import annotations

import json
import logging
import sqlite3
import time
from typing import Any

from ..audit import audit
from ..db import Database, get_setting, set_setting
from . import bridge_key_notice as notice
from . import bridge_keys as bk
from . import bridge_rotation as br
from . import bridge_rotation_peer as peers

log = logging.getLogger("smplwise.bridge_key_watchdog")

STATE_KEY = "bridge.watchdog"
GRACE_S = 60
CODES = ("overlap_overdue", "needs_repair", "verify_failed", "generation_mismatch")
SEVERITY = {"overlap_overdue": "critical", "needs_repair": "critical", "verify_failed": "alert", "generation_mismatch": "alert"}
AUDIT_ACTION = {"overlap_overdue": "bridge.rotation.overlap_overdue"}
# Short Hebrew texts for the notice body (at most 180 characters; no home-system name, no key, no key id)
DETAIL = {
    "overlap_overdue": "החלפת מפתח הגשר לא הסתיימה בזמן. Arx כבר לא מקבל את המפתח הישן. יש לפתוח הגדרות › חיבורים › מפתח הגשר.",
    "needs_repair": "החלפת מפתח הגשר נעצרה ודורשת השלמה. פתיחת דלתות מרחוק מושהית עד אז. הגדרות › חיבורים › מפתח הגשר.",
    "verify_failed": "לא אושר שהגשר ביטל את המפתח הישן אחרי ההחלפה. מומלץ צימוד מחדש. הגדרות › חיבורים › מפתח הגשר.",
    "generation_mismatch": "הגשר מדווח על דור מפתח שונה מזה של Arx. ייתכן שאחד מהם שוחזר מגיבוי. מומלץ צימוד מחדש.",
}


def _epoch(iso: str | None) -> float | None:
    return bk.epoch_of(iso)


def conditions(conn: sqlite3.Connection, now: float | None = None) -> list[dict[str, Any]]:
    """The fail-closed conditions present now, each {code, key, rotation_id, since}. Read only; never raises on a missing table."""
    t = time.time() if now is None else now
    out: list[dict[str, Any]] = []
    try:
        active = br.active_row(conn)
        last = conn.execute("SELECT * FROM bridge_rotations ORDER BY started_at DESC, rowid DESC LIMIT 1").fetchone()
    except sqlite3.OperationalError:
        return out
    if active is not None:
        began = _epoch(active.get("t0_at")) or _epoch(active.get("started_at"))
        if began is not None and t - began > br.CAP_S + GRACE_S:
            out.append({"code": "overlap_overdue", "key": f"overlap_overdue:{active['id']}", "rotation_id": active["id"],
                        "since": active.get("t0_at") or active.get("started_at")})
    if last is not None and last["state"] in ("needs_repair", "verify_failed"):
        out.append({"code": last["state"], "key": f"{last['state']}:{last['id']}", "rotation_id": last["id"],
                    "since": last["ended_at"] or last["started_at"]})
    if active is None:
        reported = peers.reported_key_generation(conn, now=t)
        cur = conn.execute("SELECT generation FROM bridge_keys WHERE state = 'current'").fetchone()
        if reported is not None and cur is not None and int(reported["generation"]) != int(cur["generation"]):
            out.append({"code": "generation_mismatch", "key": f"generation_mismatch:{int(cur['generation'])}:{int(reported['generation'])}",
                        "rotation_id": None, "since": reported["at"], "arx_generation": int(cur["generation"]),
                        "bridge_generation": int(reported["generation"])})
    return out


def reported(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    try:
        raw = json.loads(get_setting(conn, STATE_KEY) or "{}")
    except (ValueError, sqlite3.Error):
        return {}
    return {k: v for k, v in raw.items() if isinstance(k, str) and isinstance(v, dict)} if isinstance(raw, dict) else {}


def view(conn: sqlite3.Connection, now: float | None = None) -> list[dict[str, Any]]:
    """For the card: the conditions present now (codes, rotation ids and times only)."""
    return [{k: c.get(k) for k in ("code", "rotation_id", "since", "arx_generation", "bridge_generation") if c.get(k) is not None} for c in conditions(conn, now)]


def _dedupe(key: str) -> str:
    return f"{notice.SOURCE_ATTENTION}:{key}"


def check(db: Database, now: float | None = None) -> list[str]:
    """One watchdog round: report new conditions, clear ended ones. Returns the codes present now. Never raises."""
    try:
        with db.connection() as conn:
            present = conditions(conn, now)
            seen = reported(conn)
            keys = {c["key"]: c for c in present}
            for key, c in keys.items():
                if key in seen:
                    continue
                code = c["code"]
                details = {k: c[k] for k in ("code", "since", "arx_generation", "bridge_generation") if c.get(k) is not None}
                audit(conn, actor=None, action=AUDIT_ACTION.get(code, "bridge.key.watchdog"), decision="denied", resource_type="bridge_rotation",
                      resource_id=c.get("rotation_id") or "*", reason=code, details=details)
                outcome = notice.queue(conn, notice.SOURCE_ATTENTION, _dedupe(key), severity=SEVERITY[code], detail=DETAIL[code], code=code,
                                       rotation_id=c.get("rotation_id"))
                seen[key] = {"code": code, "since": c.get("since"), "notice": outcome}
            for key in [k for k in seen if k not in keys]:
                code = str(seen[key].get("code") or "")
                notice.resolve(conn, notice.SOURCE_ATTENTION, _dedupe(key))
                audit(conn, actor=None, action="bridge.key.watchdog", decision="allowed", resource_type="bridge_rotation", resource_id="*",
                      reason="cleared", details={"code": code})
                del seen[key]
            if seen != reported(conn):
                set_setting(conn, STATE_KEY, json.dumps(seen, sort_keys=True))
            return [c["code"] for c in present]
    except Exception:  # noqa: BLE001 - a report never takes the worker down; the next round looks again
        log.warning("bridge-key watchdog round failed", exc_info=True)
        return []
