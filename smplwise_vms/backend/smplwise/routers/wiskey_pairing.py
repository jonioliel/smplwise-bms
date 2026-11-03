"""WISKEY-PAIRING-2382: "חיבור Arx ל-WisKey" - the pairing status, the read-only acceptance probe and the guided re-pair.

- `GET  /system/wiskey-pairing` (`system.configure`): the status block (services/wiskey_pairing.status). Local facts and the LAST probe;
  nothing is sent to WisKey.
- `POST /system/wiskey-pairing/probe` (`system.configure` + a system administrator; "בדוק חיבור חתום"): one signed READ to WisKey's direct API (`direct/connect`, `direct/capabilities`,
  `direct/time`); never a write, never retried; at most one per 5 s (a quicker call returns the last probe). One audit row: the outcome
  code only.
- `POST /system/wiskey-pairing/repair` (`system.configure` + a system administrator; `{confirm: true, pause_rotation}`): only while the
  status offers it (no signing key, an unreadable or rotated key, or WisKey refused the key). A new pairing code (the existing re-pair of
  GET /ha/bridge/pairing?regenerate=true: the key set is wiped, every capture lease is revoked), optionally the bridge-key rotation switched
  off (it would blank the code WisKey verifies against again), and the code announced to the bridge through the Supervisor discovery when
  that path is open. Audited. Nothing is written to WisKey, a station or Home Assistant's configuration by Arx itself.

Local sessions only (remote_channel.BLOCKED_ON_REMOTE): the repair answer carries the new pairing code."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import database_of, get_setting, set_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, is_system_admin, require
from ..services import wiskey_pairing as wp

router = APIRouter()
CONFIGURE = "system.configure"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


@router.get("/system/wiskey-pairing")
def pairing_status(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The Arx <-> WisKey pairing status (read only; nothing is sent to WisKey)."""
    require(conn, principal, CONFIGURE, INSTALLATION)
    return wp.status(conn, settings_of(request))


@router.post("/system/wiskey-pairing/probe")
def pairing_probe(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """"בדוק חיבור חתום": one signed read to WisKey - does it accept Arx's pairing key, which commands does it list. System administrators."""
    require(conn, principal, CONFIGURE, INSTALLATION)
    if not is_system_admin(conn, principal.user_id):
        audit(conn, actor=principal, action="wiskey.pairing.probe", decision="denied", resource_type="installation", resource_id="*", reason="not_system_admin",
              request_id=_rid(request))
        raise ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לבדוק את החיבור החתום ל־WisKey.")
    db = database_of(conn) or request.app.state.db
    result, ran = wp.probe(db, settings_of(request))
    if ran:
        audit(conn, actor=principal, action="wiskey.pairing.probe", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
              details={"accepted": result.get("accepted"), "code": result.get("code"), "commands": len((result.get("capabilities") or {}).get("commands") or [])})
    return wp.status(conn, settings_of(request))


class RepairBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: bool
    pause_rotation: bool = True


@router.post("/system/wiskey-pairing/repair")
def pairing_repair(body: RepairBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Re-pair Arx with the bridge (and so with WisKey): a new pairing code, announced to the bridge when possible. System administrators."""
    from ..services import bridge_install, bridge_rotation as br, bridge_rotation_peer as peer_mod, capture_lease, ha_bridge, lease_events

    require(conn, principal, CONFIGURE, INSTALLATION)
    if not is_system_admin(conn, principal.user_id):
        audit(conn, actor=principal, action="wiskey.pairing.repair", decision="denied", resource_type="installation", resource_id="*", reason="not_system_admin",
              request_id=_rid(request))
        raise ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לצמד מחדש את Arx ו־WisKey.")
    if body.confirm is not True:
        raise ApiError(422, "confirm_required", "יש לאשר את הצימוד מחדש.")
    settings = settings_of(request)
    before = wp.status(conn, settings)
    reason = before["repair"]["reason"]
    if not before["repair"]["available"]:
        audit(conn, actor=principal, action="wiskey.pairing.repair", decision="denied", resource_type="installation", resource_id="*", reason="repair_not_needed",
              request_id=_rid(request))
        raise ApiError(409, "repair_not_needed", "הצימוד תקין: אין צורך בצימוד מחדש. צימוד מחדש היה מנתק את הגשר עד שיקבל את הקוד החדש.")
    if br.active_row(conn) is not None:
        raise ApiError(409, "rotation_in_progress", "החלפת מפתח גשר מתבצעת כרגע. יש להמתין לסיומה.")
    secret = ha_bridge.ensure_pairing(conn, regenerate=True)
    capture_lease.on_authority_change("repair", all=True)  # as GET /ha/bridge/pairing?regenerate=true: a new key revokes every capture lease
    lease_events.WORKER.request_reset("repair")
    peer_mod.clear_capability(conn)  # a new pairing: the bridge announces again
    paused = False
    if body.pause_rotation and br.mode(conn) == "on":
        set_setting(conn, br.FLAG_KEY, "off")
        paused = True
        audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
              details={"key": br.FLAG_KEY, "before": "on", "after": "off", "via": "wiskey.pairing.repair"})
    announced = bridge_install.announce_discovery(request.app.state.db, settings, conn) if before["repair"]["announce"] else False
    wp.forget_probe()
    audit(conn, actor=principal, action="wiskey.pairing.repair", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={"reason": reason, "announced": announced, "rotation_paused": paused})
    after = wp.status(conn, settings)
    url = bridge_install.addon_url()
    if announced:
        steps = ["בתשתית המערכת יופיע עדכון לאינטגרציה SMPLWISE Bridge עם הקוד החדש. אם מופיעה בקשת אישור - אשרו אותה.",
                 "המתינו דקה עד שהגשר ישלח עדכון חתום (השורה \"גשר Arx\" תהפוך לתקינה).",
                 "לחצו \"בדיקה מול WisKey\"."]
    else:
        steps = ["בתשתית המערכת: הגדרות › מכשירים ושירותים › SMPLWISE Bridge › שלוש הנקודות › מחיקה. "
                 "לפני כן רשמו את האפשרויות שהוגדרו בה (משתמש שירות, האצלת שמירה, הרשאות להפעלה): הן נמחקות עם הרשומה.",
                 "הוספת אינטגרציה › SMPLWISE Bridge.",
                 f"כתובת: {url} · קוד הצימוד: הקוד שמוצג כאן.",
                 "חזרו לכאן ולחצו \"בדיקה מול WisKey\"."]
    return {"announced": announced, "rotation_paused": paused, "pairing_code": None if announced else secret, "addon_url": url,
            "paired_at": get_setting(conn, "bridge.paired_at") or None, "steps": steps, "status": after}
