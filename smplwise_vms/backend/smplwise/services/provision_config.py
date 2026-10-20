"""PROVISION2 phase 2: Provision-ISR configuration writes in the NVR change log (`nvr_changes`), the same contract as the
Hikvision ISAPI writes of `nvr_write.apply_change` / `rollback`: read the document -> derive the new one -> one write -> read
again to verify -> record both documents (rollback = write the old one back) -> audit. The change-log path is
`provision:<doc>/<channel>` (never an ISAPI path), so the generic rollback can tell the two vendors apart.

Today: motion detection on / off and sensitivity (`SetMotionConfig`). The grid is never rewritten (the device's own size)."""
from __future__ import annotations

import re
import sqlite3
from typing import Any

from ..audit import audit
from ..config import Settings
from ..errors import ApiError
from .recorders import provision_isr_xml as px
from .recorders import vendor_io

PATH = re.compile(r"^provision:(?P<doc>[a-z_]{1,32})/(?P<ch>\d{1,4})$")


def path_for(doc: str, channel: int) -> str:
    return f"provision:{doc}/{int(channel)}"


def is_provision_path(path: str | None) -> bool:
    return bool(path and PATH.match(path))


def _norm(xml: str) -> str:
    """Documents compared without whitespace and attributes (the device re-sends its own attribute set)."""
    xml = re.sub(r"<\?xml[^>]*\?>", "", xml)
    xml = re.sub(r"<(\w+)(\s[^>]*)?(/?)>", lambda m: f"<{m.group(1)}{m.group(3)}>", xml)
    xml = re.sub(r"<itemType\s*/?>(</itemType>)?", "", xml)
    xml = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", xml, flags=re.S)
    return re.sub(r"\s+", "", xml)


def motion_state(settings: Settings, recorder_id: str, channel: int) -> dict[str, Any]:
    a = vendor_io.adapter(settings, recorder_id)
    return px.parse_motion(a.config_doc("motion", channel))


def apply_motion(settings: Settings, conn: sqlite3.Connection, principal: Any, *, recorder_id: str, channel: int, enabled: bool | None,
                 sensitivity: int | None, note: str, request_id: str | None) -> dict[str, Any]:
    """Motion switch and / or sensitivity of one Provision channel. `sensitivity` is on the device's own scale (its min / max,
    snapped into range like the Hikvision path). Device I/O happens with the caller's write lock released (`unlocked`)."""
    from ..db import unlocked
    from .nvr_write import _record

    a = vendor_io.adapter(settings, recorder_id)
    if not a.writes_enabled:  # refused before any device request and before anything is recorded
        raise ApiError(409, "nvr_not_supported", "כתיבה ל־NVR הזה כבויה עד לאישור.", details={"op": "motion", "reason": "writes_disabled"})
    path, target = path_for("motion", channel), f"motion-{channel}"
    with unlocked(conn):
        before = a.config_doc("motion", channel)
        facts = px.parse_motion(before)
        if sensitivity is not None:
            lo, hi = facts.get("min"), facts.get("max")
            sensitivity = max(lo if lo is not None else sensitivity, min(hi if hi is not None else sensitivity, int(sensitivity)))
        try:
            body = px.motion_set_document(before, enabled=enabled, sensitivity=sensitivity)
        except ValueError as exc:
            raise ApiError(422, "value_not_allowed", "הערך אינו בין הערכים שהמכשיר מקבל.", details={"field": str(exc)}) from exc
        unchanged = (enabled is None or facts.get("enabled") == enabled) and (sensitivity is None or facts.get("sensitivity") == sensitivity)
        failure: ApiError | None = None
        verify = before
        if not unchanged:
            try:
                a.put_config_doc("motion", channel, body)
            except ApiError as exc:
                failure = exc
            else:
                verify = a.config_doc("motion", channel)
    if failure is not None:  # recorded with the write lock held again (never inside `unlocked`)
        rec = _record(conn, principal, kind="detection", permission="nvr.config.detection", target=target, path=path, before=before, after=body,
                      status="failed", error=failure.code, note=note, recorder_id=recorder_id)
        audit(conn, actor=principal, action="nvr.write", decision="denied", resource_type="nvr", resource_id=target, reason=failure.code,
              request_id=request_id, details={"kind": "detection", "path": path, "change_id": rec["id"], "vendor": "provision_isr"})
        raise failure
    if unchanged:
        rec = _record(conn, principal, kind="detection", permission="nvr.config.detection", target=target, path=path, before=before, after=before,
                      status="unchanged", note=note, recorder_id=recorder_id)
        rec["sensitivity_written"] = sensitivity
        return rec
    got = px.parse_motion(verify)
    ok = (enabled is None or got.get("enabled") == enabled) and (sensitivity is None or got.get("sensitivity") == sensitivity)
    if not ok:
        status = "no_effect" if _norm(verify) == _norm(before) else "diverged"
        rec = _record(conn, principal, kind="detection", permission="nvr.config.detection", target=target, path=path, before=before, after=verify,
                      status=status, note=note, recorder_id=recorder_id)
        audit(conn, actor=principal, action="nvr.write", decision="denied", resource_type="nvr", resource_id=target, reason=status, request_id=request_id,
              details={"kind": "detection", "path": path, "change_id": rec["id"], "vendor": "provision_isr"})
        raise ApiError(409, "nvr_no_effect", "ה־NVR אישר את הכתיבה אבל לא שינה את ההגדרה.", details={"path": path, "change_id": rec["id"], "status": status})
    rec = _record(conn, principal, kind="detection", permission="nvr.config.detection", target=target, path=path, before=before, after=verify,
                  status="applied", note=note, recorder_id=recorder_id)
    audit(conn, actor=principal, action="nvr.write", decision="allowed", resource_type="nvr", resource_id=target, request_id=request_id,
          details={"kind": "detection", "path": path, "change_id": rec["id"], "permission": "nvr.config.detection", "note": note, "vendor": "provision_isr"})
    rec["sensitivity_written"] = sensitivity
    return rec


def rollback_document(settings: Settings, recorder_id: str, path: str, before_xml: str) -> str:
    """Write a recorded Provision document back (the generic nvr_write.rollback for a `provision:` path); returns the device's
    document read after the write. The body is rebuilt from the recorded document with the v1 Set rule (no attributes)."""
    m = PATH.match(path or "")
    if not m:
        raise ApiError(409, "not_rollbackable", "אין לשינוי הזה מסמך קודם להחזיר.", details={"path": "invalid"})
    doc, ch = m.group("doc"), int(m.group("ch"))
    if doc != "motion":
        raise ApiError(409, "not_rollbackable", "אין לשינוי הזה מסמך קודם להחזיר.", details={"doc": doc})
    facts = px.parse_motion(before_xml)
    a = vendor_io.adapter(settings, recorder_id)
    current = a.config_doc("motion", ch)
    body = px.motion_set_document(current, enabled=facts.get("enabled"), sensitivity=facts.get("sensitivity"))
    a.put_config_doc("motion", ch, body)
    return a.config_doc("motion", ch)
