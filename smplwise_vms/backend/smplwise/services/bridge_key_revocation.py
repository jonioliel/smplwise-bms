"""WXH4-EMERGENCY-REVOKE-2407: the emergency revocation of the bridge key and the re-pair with a fresh pairing code (CR-034 section 8).

Owner decisions of 07.11 (docs/changes/WXH4-EMERGENCY-REVOKE-2407.md section 2):
1. The new code reaches the bridge by itself through the EXISTING re-pair path (Arx's own Supervisor discovery message; the 0.10.3+ bridge
   checks the code with Arx - one signed ping - before it takes it). When that path is closed, an administrator reveals the code on the
   bridge-key screen and enters it in the bridge (bridge 0.10.6: "Reconfigure"). Nothing is ever signed with the revoked key.
2. Any system administrator may reveal the new code, only after a fresh re-authentication (step-up: their own current authenticator
   code); every reveal - and every refused attempt - is audited.
3. Allowed while WisKey is installed; the confirm dialog says that door opening through WisKey stops until the re-pair.
4. The emergency notice NAMES the administrator who revoked it; the audit row keeps the name and the time.
5. The bridge-key notices are an ordinary notification source (an administrator may switch them off; the revocation still happens and the
   audit says the notice was `disabled`).
6. The button is never blocked for want of an owner contact: the notice then reaches every system administrator.

State machine (setting `bridge.revocation`, installation-local, never taken from an archive - backup.SETTINGS_KEEP):

    (none | repaired) --revoke--> revoked --signed ping with the NEW code--> repaired
                                  revoked --revoke again--> revoked (a newer id and a newer code: the revealed one may have leaked)

`revoke` (one write transaction, under the rotation lock so no rotation step interleaves): every live key of the set is wiped and an
unfinished rotation closed (bridge_keys.reset_set), the plain pairing code is replaced by a fresh one, the bridge's announced capability
and reported generation are forgotten, every capture lease is revoked, the state becomes `revoked`, one audit row, one notice (under its
own savepoint: a notice that fails never undoes the revocation). The caller then announces the new code (outside the transaction).

While `revoked` EVERY bridge operation is blocked, fail closed (services/ha_bridge.py): `signing_key` answers None (nothing outbound is
signed - door, device, cast, lease, WisKey), `verify_message` refuses every inbound message (401 `bridge_revoked`) except the bridge's
pairing ping, which is checked against the NEW code only; rotations neither start nor resume (`bridge_revoked`); the old pairing route
and the WisKey re-pair route do not hand out the code (only `reveal`, with the step-up, does).

Nothing here logs, audits or returns key material; the code itself leaves only through `reveal` (and Arx's own discovery message)."""
from __future__ import annotations

import json
import secrets
import sqlite3
from typing import Any

from ..audit import audit
from ..db import get_setting, now_iso, set_setting

STATE_KEY = "bridge.revocation"
STATES = ("revoked", "repaired")
REVOKED_CODE = "bridge_revoked"
REVOKED_TEXT = "מפתח הגשר בוטל בחירום. כל הפעולות דרך הגשר מושבתות עד צימוד מחדש."
LOCK_WAIT_S = 15.0


class RevocationRefused(Exception):
    def __init__(self, code: str, status: int = 409) -> None:
        super().__init__(code)
        self.code = code
        self.status = status


def state(conn: sqlite3.Connection) -> dict[str, Any] | None:
    """The stored revocation record (None when there never was one, or it is unreadable)."""
    try:
        raw = json.loads(get_setting(conn, STATE_KEY) or "null")
    except (ValueError, sqlite3.Error):
        return None
    return raw if isinstance(raw, dict) and raw.get("state") in STATES else None


def is_revoked(conn: sqlite3.Connection) -> bool:
    """True from the revocation until the bridge proved the NEW code with a signed ping. Never raises (a database without the settings
    table reads as not revoked)."""
    try:
        s = state(conn)
    except Exception:  # noqa: BLE001
        return False
    return bool(s and s["state"] == "revoked")


def _save(conn: sqlite3.Connection, s: dict[str, Any]) -> None:
    set_setting(conn, STATE_KEY, json.dumps(s, sort_keys=True))


def actor_name(conn: sqlite3.Connection, actor: Any) -> str:
    uid = getattr(actor, "user_id", None)
    if uid:
        r = conn.execute("SELECT display_name, username FROM users WHERE id = ?", (uid,)).fetchone()
        if r and (r["display_name"] or r["username"]):
            return str(r["display_name"] or r["username"])
    return str(getattr(actor, "display_name", None) or getattr(actor, "username", None) or uid or "")


def revoke(conn: sqlite3.Connection, *, actor: Any, request_id: str | None = None, wiskey_present: bool = False) -> dict[str, Any]:
    """The revocation itself, in the caller's write transaction (see the module docstring). Returns the new state record."""
    from . import bridge_key_notice, bridge_keys as bk, bridge_rotation_peer as peers, ha_bridge

    before = state(conn)
    rid = "rev-" + secrets.token_hex(6)
    at = now_iso()
    name = actor_name(conn, actor)
    wiped = bk.reset_set(conn)  # every live key wiped (sealed blobs NULLed), an unfinished rotation closed - including `needs_repair`
    conn.execute("DELETE FROM settings WHERE key = 'bridge.secret'")  # the plain pairing code (before the first rotation) is the key too
    ha_bridge.ensure_pairing(conn, regenerate=True)  # a fresh code, `bridge.paired_at` cleared
    peers.clear_capability(conn)  # the bridge must announce itself again after the re-pair
    _save(conn, {"id": rid, "state": "revoked", "revoked_at": at, "revoked_by": getattr(actor, "user_id", None), "revoked_by_name": name,
                 "wiskey_present": bool(wiskey_present), "repaired_at": None, "reveals": 0, "last_reveal_at": None,
                 "previous": before.get("id") if before else None})
    audit(conn, actor=actor, action="bridge.key.revoked", decision="allowed", resource_type="bridge_key", resource_id=rid, request_id=request_id,
          details={"revocation_id": rid, "actor_name": name, "at": at, "keys_wiped": wiped, "wiskey_present": bool(wiskey_present),
                   "owner_contacts_set": bool(bridge_key_notice.valid_contacts(conn)),
                   "replaces": before.get("id") if before and before.get("state") == "revoked" else None})
    outcome = bridge_key_notice.emergency(conn, actor=actor, revocation_id=rid, name=name)
    s = state(conn) or {}
    return {**s, "notice": outcome}


def after_revoke(db: Any, settings: Any) -> None:
    """After the revocation committed: the capture leases go, the lease worker asks for a new stream, the write-ahead log drops the wiped
    blobs. Never raises."""
    from . import bridge_keys as bk

    try:
        from . import capture_lease, lease_events

        capture_lease.on_authority_change("repair", all=True)
        lease_events.WORKER.request_reset("repair")
    except Exception:  # noqa: BLE001
        pass
    bk.scrub(db)


def on_paired(conn: sqlite3.Connection, version: Any = None) -> bool:
    """The bridge's pairing ping verified against the NEW code: the revocation ends (`repaired`). Returns True when it ended one."""
    s = state(conn)
    if not s or s["state"] != "revoked":
        return False
    s.update(state="repaired", repaired_at=now_iso())
    _save(conn, s)
    audit(conn, actor=None, action="bridge.key.repaired", decision="allowed", resource_type="bridge_key", resource_id=s["id"],
          details={"revocation_id": s["id"], "integration_version": str(version or "")[:32] or None})
    return True


def reveal(conn: sqlite3.Connection, *, actor: Any, request_id: str | None = None) -> str:
    """The new pairing code, for the manual entry in the bridge (owner decision 2). Only while `revoked` and while the code is still the
    plain one (it is adopted into the key set only by a later rotation). The caller has already checked the step-up. Audited."""
    s = state(conn)
    if not s or s["state"] != "revoked":
        raise RevocationRefused("not_revoked")
    code = get_setting(conn, "bridge.secret")
    if not code:
        raise RevocationRefused("no_code")
    name = actor_name(conn, actor)
    s.update(reveals=int(s.get("reveals") or 0) + 1, last_reveal_at=now_iso())
    _save(conn, s)
    audit(conn, actor=actor, action="bridge.key.code_revealed", decision="allowed", resource_type="bridge_key", resource_id=s["id"], request_id=request_id,
          details={"revocation_id": s["id"], "actor_name": name, "at": s["last_reveal_at"], "step_up": "totp"})
    return code


def view(conn: sqlite3.Connection) -> dict[str, Any]:
    """For the bridge-key card: the revocation state (names and times only - never the code)."""
    s = state(conn)
    return {
        "state": s["state"] if s else "none",
        "id": s.get("id") if s else None,
        "revoked_at": s.get("revoked_at") if s else None,
        "revoked_by_name": s.get("revoked_by_name") if s else None,
        "repaired_at": s.get("repaired_at") if s else None,
        "reveals": int(s.get("reveals") or 0) if s else 0,
        "last_reveal_at": s.get("last_reveal_at") if s else None,
    }
