"""Frigate zones and camera settings (FRGS, docs/changes/CR-029-FRIGATE-PROVIDER.md section 13): the rules around the config write of
`recorders/frigate_config.py`.

The same model of a write as F2 / F2b (`frigate_control_svc`): permission (`system.configure` on the camera) -> the class `config` switched
on for the recorder (OFF by default) -> a per-action confirmation (a config write persists in Frigate's configuration file and changes
what is detected) -> the first write of each kind (`config_zone`, `config_settings`) only under supervision (`frigate_first_write`, the
F2b flag: a system administrator says they are watching it) -> read before, ONE write, read back -> a change-log row (before / after) and
an audit row -> undo from the log (`frigate_control_svc.revert`), which first checks that Frigate still shows what the change left.

Nothing here retries, queues, restarts Frigate or writes more than one section of one camera."""
from __future__ import annotations

import sqlite3
from typing import Any

from ..errors import ApiError
from ..rbac import Principal
from . import frigate_control_svc as cs
from . import frigate_native_svc as native
from .recorders import frigate_config as fcfg
from .recorders.frigate import FrigateAdapter

KINDS = ("config_zone", "config_settings")


def camera_view(adapter: FrigateAdapter, camera_key: str) -> dict[str, Any]:
    return fcfg.FrigateConfig(adapter).camera(camera_key)


def _base(adapter: FrigateAdapter, cam: sqlite3.Row, kind: str, target: str, request_id: str | None) -> dict[str, Any]:
    return dict(recorder_id=adapter.recorder_id, camera_id=cam["id"], camera_key=cam["source_ref"], cls="config", kind=kind, target=target, request_id=request_id)


def _gates(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter, cam: sqlite3.Row, kind: str, *, confirm: bool, supervised: bool,
           request_id: str | None) -> None:
    cs._gate(conn, principal, adapter.recorder_id, "config", cam["id"], confirm=confirm, request_id=request_id, what=kind)
    native.check_supervised(conn, principal, adapter.recorder_id, kind, supervised, request_id)


# ---------------------------------------------------------------------------------------------- zones

def put_zone(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter, cam: sqlite3.Row, name: str, body: dict[str, Any], *, confirm: bool,
             supervised: bool, request_id: str | None) -> dict[str, Any]:
    """Create or replace ONE zone of ONE camera."""
    fcfg.zone_name(name)
    want = fcfg.zone_in(body)
    _gates(conn, principal, adapter, cam, "config_zone", confirm=confirm, supervised=supervised, request_id=request_id)
    if name == cam["source_ref"]:
        raise ApiError(422, "frigate_zone_name_invalid", "שם האזור אינו יכול להיות שם המצלמה.")
    cfg = fcfg.FrigateConfig(adapter)
    view = cfg.camera(cam["source_ref"])
    cur = next((z for z in view["zones"] if z["name"] == name), None)
    if cur is None and len(view["zones"]) >= fcfg.ZONES_MAX:
        raise ApiError(422, "frigate_zone_limit", "הגעתם למספר האזורים המרבי למצלמה.", details={"max": fcfg.ZONES_MAX})
    if cur is not None and not cur["editable"]:
        raise ApiError(409, "frigate_zone_not_editable", "האזור הזה נשמר ב־Frigate בצורה ש־Arx אינו עורך.")
    before, after = fcfg.comparable(cur), fcfg.comparable(want)
    if before == after:
        return {"changed": False, "zone": cur, "verified": True, "change_id": None}
    base = _base(adapter, cam, "config_zone", name, request_id)
    try:
        cfg.write_zone(cam["source_ref"], name, want)
    except ApiError as exc:
        raise cs._failed(conn, principal, exc, before=before, after=after, state_hash=None, **base) from None
    verified, seen = _zone_back(cfg, cam["source_ref"], name, after)
    cid = cs._log(conn, principal, before=before, after=after, state_hash=None, status="applied" if verified else "unverified", **base)
    native.mark_first_write(conn, principal, adapter.recorder_id, "config_zone")
    return {"changed": True, "zone": seen or {"name": name, **want}, "verified": verified, "change_id": cid}


def delete_zone(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter, cam: sqlite3.Row, name: str, *, confirm: bool, supervised: bool,
                request_id: str | None) -> dict[str, Any]:
    fcfg.zone_name(name)
    _gates(conn, principal, adapter, cam, "config_zone", confirm=confirm, supervised=supervised, request_id=request_id)
    cfg = fcfg.FrigateConfig(adapter)
    cur = cfg.zone(cam["source_ref"], name)
    if cur is None:
        raise ApiError(404, "not_found", "האזור לא נמצא.")
    if not cur["editable"]:
        raise ApiError(409, "frigate_zone_not_editable", "האזור הזה נשמר ב־Frigate בצורה ש־Arx אינו עורך.")
    before = fcfg.comparable(cur)
    # security review 2.4.2 L6: the fields Arx does not model go into the change log too, so the undo puts the whole zone back
    # (a zone whose extra fields cannot be kept is refused with 409 before anything is written)
    extra = cfg.zone_extra(cam["source_ref"], name)
    if extra and before is not None:
        before = {**before, "extra": extra}
    base = _base(adapter, cam, "config_zone", name, request_id)
    try:
        cfg.write_zone(cam["source_ref"], name, None)
    except ApiError as exc:
        raise cs._failed(conn, principal, exc, before=before, after=None, state_hash=None, **base) from None
    verified, _ = _zone_back(cfg, cam["source_ref"], name, None)
    cid = cs._log(conn, principal, before=before, after=None, state_hash=None, status="applied" if verified else "unverified", **base)
    native.mark_first_write(conn, principal, adapter.recorder_id, "config_zone")
    return {"deleted": True, "verified": verified, "change_id": cid}


def _zone_back(cfg: fcfg.FrigateConfig, camera_key: str, name: str, want: dict[str, Any] | None) -> tuple[bool, dict[str, Any] | None]:
    try:
        seen = cfg.zone(camera_key, name)
    except ApiError:
        return False, None
    if want is None or "extra" not in want:
        return fcfg.comparable(seen) == want, seen
    # an undo of a delete: the modelled fields as before, and the unmodelled ones Frigate shows again
    try:
        extra_now = cfg.zone_extra(camera_key, name)
    except ApiError:
        return False, seen
    return fcfg.comparable(seen) == {k: v for k, v in want.items() if k != "extra"} and extra_now == want["extra"], seen


# ---------------------------------------------------------------------------------------------- settings

def put_settings(conn: sqlite3.Connection, principal: Principal, adapter: FrigateAdapter, cam: sqlite3.Row, section: str, values: dict[str, Any], *, confirm: bool,
                 supervised: bool, request_id: str | None) -> dict[str, Any]:
    """Several settings of ONE section of ONE camera. Only the keys whose value differs from what Frigate shows are written."""
    if section not in fcfg.SECTIONS:
        raise ApiError(422, "frigate_config_section_unknown", "הקבוצה אינה מוכרת.", details={"section": str(section)[:30]})
    if not values:
        raise ApiError(422, "frigate_config_value_invalid", "לא נבחר אף ערך.")
    clean: dict[str, Any] = {}
    for key, val in values.items():
        if fcfg.SETTING.get(key, {}).get("section") != section:
            raise ApiError(422, "frigate_config_key_unknown", "ההגדרה אינה שייכת לקבוצה.", details={"key": str(key)[:60]})
        clean[key] = fcfg.setting_value(key, val)
    _gates(conn, principal, adapter, cam, "config_settings", confirm=confirm, supervised=supervised, request_id=request_id)
    cfg = fcfg.FrigateConfig(adapter)
    cur = cfg.camera(cam["source_ref"])["settings"]
    diff = {k: v for k, v in clean.items() if not fcfg.same_setting(k, cur.get(k), v)}
    if not diff:
        return {"changed": False, "settings": {k: cur.get(k) for k in clean}, "verified": True, "change_id": None}
    before, after = {k: cur.get(k) for k in diff}, dict(diff)
    base = _base(adapter, cam, "config_settings", section, request_id)
    try:
        cfg.write_settings(cam["source_ref"], section, diff)
    except ApiError as exc:
        raise cs._failed(conn, principal, exc, before=before, after=after, state_hash=None, **base) from None
    verified, seen = _settings_back(cfg, cam["source_ref"], after)
    cid = cs._log(conn, principal, before=before, after=after, state_hash=None, status="applied" if verified else "unverified", **base)
    native.mark_first_write(conn, principal, adapter.recorder_id, "config_settings")
    return {"changed": True, "settings": seen, "verified": verified, "change_id": cid}


def _settings_back(cfg: fcfg.FrigateConfig, camera_key: str, want: dict[str, Any]) -> tuple[bool, dict[str, Any]]:
    try:
        now = cfg.camera(camera_key)["settings"]
    except ApiError:
        return False, {}
    seen = {k: now.get(k) for k in want}
    return all(fcfg.same_setting(k, seen[k], v) for k, v in want.items()), seen


# ---------------------------------------------------------------------------------------------- undo (called by frigate_control_svc.revert)

def revert_kind(adapter: FrigateAdapter, row: sqlite3.Row, before: Any, after: Any) -> bool:
    """Write the state before the change back, after checking Frigate still shows the state the change left (409 `frigate_change_stale`)."""
    cfg = fcfg.FrigateConfig(adapter)
    cam, kind, target = row["camera_key"], row["kind"], row["target"]

    def stale() -> ApiError:
        return ApiError(409, "frigate_change_stale", "המצב ב־Frigate השתנה מאז השינוי. קראו את המצב ונסו שוב.", details={"kind": kind})

    if kind == "config_zone":
        if fcfg.comparable(cfg.zone(cam, target)) != after:
            raise stale()
        cfg.write_zone(cam, target, before)
        return _zone_back(cfg, cam, target, before)[0]
    if kind == "config_settings":
        now = cfg.camera(cam)["settings"]
        if not all(fcfg.same_setting(k, now.get(k), v) for k, v in (after or {}).items()):
            raise stale()
        cfg.write_settings(cam, target, dict(before or {}))
        return _settings_back(cfg, cam, dict(before or {}))[0]
    raise ApiError(409, "frigate_change_not_reversible", "לא ניתן לבטל את השינוי הזה.")
