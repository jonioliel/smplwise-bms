"""Camera registry: stable local ids per (recorder, channel), aliases and order kept locally (T013),
discovery by a read-only ISAPI sync that never renames anything on the device.

CR-024 (multi-NVR): every camera carries its `recorder_id`; device calls use the camera's own recorder
(recorder_scope.camera_settings). `GET /cameras` takes `?recorder_id=` and lists the recorders that have visible cameras
(`recorders`, id + name only - for the operator screens' recorder filter); cameras of a REMOVED recorder are never listed
(owner decision: disabled and invisible, history kept). `POST /cameras/sync` and `POST /cameras` take `recorder_id`
(default: every active recorder / the first recorder)."""
from __future__ import annotations

import json
import datetime as dt
import sqlite3
import time
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from fastapi.responses import Response

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import unlocked, new_id, now_iso
from ..errors import ApiError, not_found
from ..mode import ensure_nvr  # NVR-less mode: 409 nvr_not_configured
from ..rbac import INSTALLATION, Principal, authorize, require
from ..recorder_scope import PRIMARY, camera_settings, ready_ids, settings_for
from ..services import autosync, nvr, stream_codecs
from ..services.access import camera_allowed, require_camera, visible_camera_ids
from .anchors import camera_row
from .settings import read_settings

router = APIRouter()

DEFAULT_RECORDER = PRIMARY


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _ensure_recorder(conn: sqlite3.Connection, name: str = "NVR ראשי", model: str | None = None, firmware: str | None = None) -> None:
    conn.execute(
        """INSERT INTO recorders(id, name, model, firmware, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET model = COALESCE(excluded.model, recorders.model), firmware = COALESCE(excluded.firmware, recorders.firmware), last_seen_at = excluded.last_seen_at""",
        (DEFAULT_RECORDER, name, model, firmware, now_iso(), now_iso()),
    )


def disambiguate(cameras: list[dict[str, Any]], recorder_names: dict[str, str] | None = None) -> list[dict[str, Any]]:
    """Two channels with the same NVR name (the lab has "כניסה M1" twice) are told apart by their channel number in
    every list, wall and selector; an alias set in the VMS wins as before (live review F24). CR-024: when the same name
    sits on two recorders, the recorder's name is added too ("שער · NVR מחסן · ערוץ 1")."""
    seen: dict[str, int] = {}
    recorders_of: dict[str, set[str]] = {}
    for c in cameras:
        seen[c["name"]] = seen.get(c["name"], 0) + 1
        recorders_of.setdefault(c["name"], set()).add(str(c.get("recorder_id") or PRIMARY))
    for c in cameras:
        if seen[c["name"]] > 1:
            if len(recorders_of[c["name"]]) > 1 and recorder_names:
                rec = recorder_names.get(str(c.get("recorder_id") or PRIMARY)) or str(c.get("recorder_id"))
                c["name"] = f"{c['name']} · {rec} · ערוץ {c['channel']}"
            else:
                c["name"] = f"{c['name']} · ערוץ {c['channel']}"
    return cameras


def removed_recorders(conn: sqlite3.Connection) -> set[str]:
    """CR-024: recorders removed by an administrator - their cameras are left out of every camera list (history kept)."""
    try:
        return {r[0] for r in conn.execute("SELECT id FROM recorders WHERE removed_at IS NOT NULL").fetchall()}
    except sqlite3.OperationalError:  # a database before 0055
        return set()


def recorder_names(conn: sqlite3.Connection) -> dict[str, str]:
    return {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM recorders").fetchall()}


@router.get("/cameras")
def list_cameras(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn),
                 recorder_id: str | None = Query(None, max_length=40)) -> dict[str, Any]:
    """Cameras the caller may see: everything for installation-wide readers, otherwise only cameras
    anchored on floors the caller can read. CR-024: `recorder_id` filters by recorder; cameras of a removed recorder are
    never listed; `recorders` names the recorders of the visible cameras (for a recorder filter, shown when there are 2+)."""
    gone = removed_recorders(conn)
    rows = [r for r in conn.execute("SELECT * FROM cameras ORDER BY sort_order, channel").fetchall() if r["recorder_id"] not in gone]
    ids = visible_camera_ids(conn, principal, "map.read")
    visible = rows if ids is None else [r for r in rows if r["id"] in ids]
    names = recorder_names(conn)
    present = sorted({r["recorder_id"] for r in visible}, key=lambda rid: (rid != PRIMARY, rid))
    if recorder_id:
        visible = [r for r in visible if r["recorder_id"] == recorder_id]
    recorder = conn.execute("SELECT * FROM recorders WHERE id = ?", (DEFAULT_RECORDER,)).fetchone()
    live_ok = {r["id"]: camera_allowed(conn, principal, r["id"], "video.live") for r in visible}
    multi = len(present) > 1
    from ..recorder_scope import is_disabled

    off = {rid for rid in present if is_disabled(rid)}  # CR-024: a disabled recorder's cameras are not offered for live / snapshots
    return {
        "cameras": disambiguate([dict(camera_row(r), can_view_live=live_ok[r["id"]] and r["recorder_id"] not in off, recorder_enabled=r["recorder_id"] not in off,
                                      recorder_name=names.get(r["recorder_id"]) if multi else None) for r in visible], names),
        "recorders": [{"id": rid, "name": names.get(rid) or rid} for rid in present],
        "recorder": {"id": recorder["id"], "name": recorder["name"], "model": recorder["model"], "firmware": recorder["firmware"], "last_seen_at": recorder["last_seen_at"]} if recorder else None,
        "can_sync": authorize(conn, principal, "sources.configure", INSTALLATION).allowed,
        "media": read_settings(conn),
    }


@router.get("/cameras/{camera_id}/snapshot.jpg")
def snapshot(camera_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    """Fresh JPEG from the NVR (read-only), cached in /data for `snapshots.max_age_s`; a stale copy is
    served with X-Snapshot-Stale when the NVR is unreachable. Same permission as live video."""
    settings = settings_of(request)
    require_camera(conn, principal, camera_id, "video.live")  # T055: 403 before 404 - an unknown id tells a scoped user nothing
    ensure_nvr(settings_of(request))  # NVR-less mode: 409 after the permission check
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if not cam:
        raise not_found("המצלמה לא נמצאה.")
    from ..mode import recorder_unavailable
    from ..recorder_scope import is_disabled

    if is_disabled(cam["recorder_id"]):  # CR-024: disabled now - not even a cached picture
        raise recorder_unavailable(cam["recorder_id"])
    max_age = read_settings(conn)["snapshots.max_age_s"]
    folder = settings.data_dir / "snapshots"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{camera_id}.jpg"
    stale_ok = path.exists()
    fresh = stale_ok and (now_ts() - path.stat().st_mtime) < max_age
    if not fresh:
        try:
            with unlocked(conn):
                from ..services.recorders import vendor_io

                rs = camera_settings(settings, cam)
                from ..services.recorders import frigate_io

                if frigate_io.handles(rs):  # NN5 F1: the latest frame of a Frigate camera through its adapter (credentials stay server-side)
                    data = frigate_io.snapshot(rs, cam["recorder_id"], cam["source_ref"] or str(cam["channel"]))
                else:
                    data = vendor_io.snapshot(rs, cam["recorder_id"], cam["channel"]) if vendor_io.handles(rs) else nvr.fetch_snapshot(rs, cam["channel"])
            path.write_bytes(data)
        except ApiError as exc:
            if not stale_ok:
                raise
            return Response(path.read_bytes(), media_type="image/jpeg", headers={"Cache-Control": "private, max-age=10", "X-Snapshot-Stale": "true", "X-Snapshot-Error": exc.code})
    age = int(now_ts() - path.stat().st_mtime)
    return Response(path.read_bytes(), media_type="image/jpeg", headers={"Cache-Control": f"private, max-age={max(1, max_age - age)}", "X-Snapshot-Age": str(age)})


def now_ts() -> float:
    import time

    return time.time()


@router.post("/cameras/sync")
def sync_cameras(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn),
                 recorder_id: str | None = Query(None, max_length=40)) -> dict[str, Any]:
    """Read-only discovery from the NVR: channels, online flag and track ids. Existing aliases/order survive.
    The same discovery also runs automatically at start-up and every few minutes (services/autosync).
    CR-024: `recorder_id` syncs one recorder; without it the first recorder answers as before and every further recorder
    this process runs is synced too (`recorders`: each one's outcome; one failing recorder never fails another)."""
    require(conn, principal, "sources.configure", INSTALLATION)
    settings = settings_of(request)
    ensure_nvr(settings)  # NVR-less mode: 409 after the permission check
    if recorder_id:
        from .recorders import recorder_settings

        recorder_settings(request, conn, recorder_id)  # 404 for an unknown / removed recorder
        return autosync.sync_cameras(settings, conn, actor=principal, request_id=_rid(request), reason="manual", recorder_id=recorder_id)
    others = [rid for rid in ready_ids(settings) if rid != PRIMARY]
    if not others:
        return autosync.sync_cameras(settings, conn, actor=principal, request_id=_rid(request), reason="manual")
    results: dict[str, Any] = {}
    first: dict[str, Any] | None = None
    for rid in ([PRIMARY] if settings_for(settings, PRIMARY).nvr_host else []) + others:
        try:
            out = autosync.sync_cameras(settings, conn, actor=principal, request_id=_rid(request), reason="manual", recorder_id=rid)
            results[rid] = {"ok": True, **out}
            first = first or out
        except ApiError as exc:
            results[rid] = {"ok": False, "error": exc.code}
    base = first or {"channels": 0, "created": 0, "updated": 0, "recorder": None}
    return {**base, "channels": sum(r.get("channels", 0) for r in results.values()), "created": sum(r.get("created", 0) for r in results.values()),
            "updated": sum(r.get("updated", 0) for r in results.values()), "recorders": results}


class CameraPatch(BaseModel):
    alias: str | None = Field(default=None, max_length=120)
    sort_order: int | None = None
    enabled: bool | None = None
    # grid_col_span (T091): how many columns wide this camera's tile is on the all-cameras grid; a hard cap
    # of 4 is a deliberate, sane bound - not configurable.
    grid_col_span: int | None = Field(default=None, ge=1, le=4)
    # wall_hidden: "לא להציג" - the camera is left out of the all-cameras wall and the kiosk pages derived from it;
    # true and false are both real values (false shows it again), None leaves the field alone.
    wall_hidden: bool | None = None


@router.patch("/cameras/{camera_id}")
def update_camera(camera_id: str, body: CameraPatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "sources.configure", INSTALLATION)
    if not conn.execute("SELECT 1 FROM cameras WHERE id = ?", (camera_id,)).fetchone():
        raise not_found("המצלמה לא נמצאה.")
    fields = {k: (int(v) if isinstance(v, bool) else v) for k, v in body.model_dump().items() if v is not None}
    if fields:
        sets = ", ".join(f"{k} = ?" for k in fields)
        conn.execute(f"UPDATE cameras SET {sets}, updated_at = ? WHERE id = ?", (*fields.values(), now_iso(), camera_id))
    audit(conn, actor=principal, action="camera.update", decision="allowed", resource_type="camera", resource_id=camera_id, request_id=_rid(request), details=fields)
    return camera_row(conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone())


class CameraIn(BaseModel):
    """Manual registration (no NVR reachable yet): channel number and a local alias. CR-024: `recorder_id` (default the first)."""
    channel: int = Field(ge=1, le=256)
    alias: str = Field(min_length=1, max_length=120)
    recorder_id: str | None = Field(default=None, max_length=40)


@router.post("/cameras", status_code=201)
def create_camera(body: CameraIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "sources.configure", INSTALLATION)
    ensure_nvr(settings_of(request))  # NVR-less mode: no NVR channel to register (after the permission check)
    rec = body.recorder_id or DEFAULT_RECORDER
    if rec == DEFAULT_RECORDER:
        _ensure_recorder(conn)
    else:
        from .recorders import recorder_settings

        recorder_settings(request, conn, rec)  # 404 for an unknown / removed recorder
    existing = conn.execute("SELECT id FROM cameras WHERE recorder_id = ? AND channel = ?", (rec, body.channel)).fetchone()
    if existing:
        conn.execute("UPDATE cameras SET alias = ?, updated_at = ? WHERE id = ?", (body.alias, now_iso(), existing["id"]))
        cid = existing["id"]
    else:
        cid, now = new_id(), now_iso()
        conn.execute("INSERT INTO cameras(id, recorder_id, channel, alias, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", (cid, rec, body.channel, body.alias, body.channel, now, now))
        try:  # CR-024: the vendor key (Hikvision: the channel number) so a later discovery matches this row
            conn.execute("UPDATE cameras SET source_ref = ? WHERE id = ?", (str(body.channel), cid))
        except sqlite3.OperationalError:
            pass
    audit(conn, actor=principal, action="camera.register", decision="allowed", resource_type="camera", resource_id=cid, request_id=_rid(request),
          details={"channel": body.channel, "alias": body.alias, **({"recorder_id": rec} if rec != DEFAULT_RECORDER else {})})
    return camera_row(conn.execute("SELECT * FROM cameras WHERE id = ?", (cid,)).fetchone())


# ---------------------------------------------------------------- detection zones (T075, read-only)

ZONES = nvr.fetch_detection_zones  # seam for tests
_ZONES_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
ZONES_TTL_S = 60


def _motion_caps(request: Request, conn: sqlite3.Connection, channel: int, cam: Any = None) -> dict[str, int] | None:
    """The sensitivity min / max / step the device reports (only for editors; one cached GET per channel)."""
    from ..services import nvr_write

    try:
        with unlocked(conn):
            return nvr_write.motion_capabilities(camera_settings(settings_of(request), cam), channel)
    except ApiError:
        return None


@router.get("/cameras/{camera_id}/zones")
def detection_zones(camera_id: str, request: Request, refresh: bool = False, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The camera's detection configuration as the NVR holds it — motion grid, privacy mask, intrusion regions,
    line-crossing lines — read-only (ISAPI GET), cached for a minute, same permission as live video. These are
    polygons in the camera image and have nothing to do with rooms on the floor plan; a browser overlay is not
    an NVR mask and protects no recording. Editing needs an explicit approval and a verified write (not in the pilot)."""
    require_camera(conn, principal, camera_id, "video.live")  # T055: 403 before 404 - an unknown id tells a scoped user nothing
    ensure_nvr(settings_of(request))  # NVR-less mode: 409 after the permission check
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if not cam:
        raise not_found("המצלמה לא נמצאה.")
    now = time.time()
    hit = _ZONES_CACHE.get(camera_id)
    if hit and not refresh and now - hit[0] < ZONES_TTL_S:
        data, fetched_at = hit[1], hit[0]
    else:
        with unlocked(conn):
            data = ZONES(camera_settings(settings_of(request), cam), int(cam["channel"]))
        fetched_at = now
        _ZONES_CACHE[camera_id] = (fetched_at, data)
    return {
        "camera_id": camera_id,
        "channel": int(cam["channel"]),
        "source": "nvr",
        "read_only": True,
        "write_reason": "editing the motion grid needs the sensitive permission nvr.config.detection (custom role); masks and smart rules are still read-only",
        "can_edit_motion": authorize(conn, principal, "nvr.config.detection", INSTALLATION).allowed,
        "sensitivity_caps": _motion_caps(request, conn, int(cam["channel"]), cam) if authorize(conn, principal, "nvr.config.detection", INSTALLATION).allowed else None,
        "fetched_at": dt.datetime.fromtimestamp(fetched_at, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "cached": bool(hit) and not refresh and now - hit[0] < ZONES_TTL_S,
        **data,
    }


# ---------------------------------------------------------------- capability facts (T045 / T012, read-only)

CAPS = nvr.fetch_capabilities  # seam for tests
_CAPS_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
CAPS_TTL_S = 300


@router.get("/cameras/{camera_id}/capabilities")
def camera_capabilities(camera_id: str, request: Request, refresh: bool = False, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """What the NVR says this camera can do — PTZ (supported / unsupported / unknown, with the device's reason),
    its preset list, two-way audio (available / disabled / unsupported / unknown). Read-only, cached five minutes,
    same permission as live video. Moving the camera, recalling a preset or talking are device writes: not offered
    in the pilot, and never shown as a fake control. Digital zoom is a browser-side enlargement, not a camera move."""
    require_camera(conn, principal, camera_id, "video.live")  # T055: 403 before 404 - an unknown id tells a scoped user nothing
    ensure_nvr(settings_of(request))  # NVR-less mode: 409 after the permission check
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if not cam:
        raise not_found("המצלמה לא נמצאה.")
    now = time.time()
    hit = _CAPS_CACHE.get(camera_id)
    cached = bool(hit) and not refresh and now - hit[0] < CAPS_TTL_S
    if cached:
        data, fetched_at = hit[1], hit[0]
    else:
        with unlocked(conn):
            data = CAPS(camera_settings(settings_of(request), cam), int(cam["channel"]))
        fetched_at = now
        _CAPS_CACHE[camera_id] = (fetched_at, data)
    return {
        "camera_id": camera_id,
        "channel": int(cam["channel"]),
        "source": "nvr",
        "read_only": True,
        "writes": {"ptz_move": "not_offered", "preset_recall": "not_offered", "talk": "not_offered", "reason": "device writes need an explicit approval; nothing is simulated"},
        "digital_zoom": "browser_only",
        "fetched_at": dt.datetime.fromtimestamp(fetched_at, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "cached": cached,
        **data,
        # CR-008 D7: from the capability registry (the last discovery), not from this request
        "video": _video_facts(conn, cam),
    }


def _video_facts(conn: sqlite3.Connection, cam: sqlite3.Row) -> dict[str, Any] | None:
    """The stream encodings the discovery stored for this camera, with the settings hint when the main stream will not
    play over WebRTC (Hebrew, the NVR menu path when deviceInfo names the model)."""
    enc = stream_codecs.encoding_of(cam)
    if not enc:
        return None
    hint = stream_codecs.main_hint(stream_codecs.camera_name(cam), int(cam["channel"]), enc.get("main"), stream_codecs.recorder_model(conn, cam["recorder_id"]))
    return {**enc, "hint": hint}

