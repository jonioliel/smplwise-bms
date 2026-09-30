"""The camera card of the area screens (owner 2026-09-30): which cameras a card may point at, and what one card resolves to.

A card's source is one of
- `{kind: 'nvr', recorder_id, channel}` - an NVR channel of the camera catalogue (`cameras`), streamed by the existing live
  relay (routers/media.py, go2rtc stream `smplwise_<recorder>_ch<n>_<profile>`);
- `{kind: 'ha', entity_id}` - a Home Assistant `camera.*` entity. When that entity is one of the NVR's own channels (the
  Hikvision integration exposes every channel of the recorder) it is mapped to the catalogue camera and streams exactly
  like the NVR source (`link_ha_cameras`); any other camera has no stream of ours - the card shows a still picture
  (docs/design/CAMERA_CARD_HA_SOURCE.md).

Nothing here starts a stream, writes to go2rtc or calls Home Assistant: the permission and the mapping only. The
stream itself stays behind `WS /media/live/{camera_id}/ws`, which authorizes, caps and audits it as for any live view.

The mapping rule (conservative - a wrong link would show another camera's picture under a name that says otherwise):
an entity is linked to NVR channel N only when ALL of these hold
1. its domain is `camera`, its registry platform is `hikvision`, and it is not removed;
2. its entity id ends `_<channel>0<track>` with track 1 (main) or 2 (sub) - the integration's `<channel>01` / `<channel>02`
   naming (`..._101` = channel 1 main, `..._102` = channel 1 sub, `..._1601` = channel 16 main);
3. its object id starts with the recorder's model name as the integration slugs it (`DS-7616NXI-K2/D` ->
   `ds_7616nxi_k2_d_`): a standalone Hikvision camera of the same integration does not carry the recorder's model;
4. every entity that passes 1-3 for that recorder belongs to ONE registry device (two devices with the same model - two
   recorders of one model - cannot be told apart, so none is linked), and exactly one recorder has that model slug;
5. the catalogue has that channel on that recorder, enabled.
The recorder's serial number is not stored by the discovery (only model and firmware), so it is not part of the rule."""
from __future__ import annotations

import re
import sqlite3
from typing import Any

from ..audit import audit
from ..rbac import INSTALLATION, Principal, authorize
from . import devices as svc
from . import ha_scope
from .access import camera_decision, camera_scope

HA_CAMERA_RE = re.compile(r"^camera\.[A-Za-z0-9_]{1,200}$")
RECORDER_ID_RE = re.compile(r"^[A-Za-z0-9_.-]{1,64}$")
HIK_SUFFIX_RE = re.compile(r"_(\d{1,3})0([12])$")
HIKVISION = "hikvision"
READ = "devices.read"
LIVE = "video.live"

# the states a card can be in (the reply's `state`)
LIVE_STATE = "live"  # a stream through the live relay
STILL_ONLY = "still_only"  # a Home Assistant camera that is not an NVR channel: a refreshed picture only
HA_LIVE = "ha_live"  # the same camera when the owner chose to show it live (services/ha_camera_streams.py): a stream of ours
FORBIDDEN = "forbidden"  # the caller may not watch it (also: may not see the entity) - nothing about it is named
MISSING = "missing"  # the channel / entity is not (or no longer) in the catalogue
DISABLED = "disabled"  # the camera is switched off in the product


def slug(text: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (text or "").lower()).strip("_")


def channel_of(entity_id: str) -> tuple[int, str] | None:
    """(channel, profile) of an entity id ending `_<channel>01` / `_<channel>02`, else None."""
    m = HIK_SUFFIX_RE.search(entity_id or "")
    if not m:
        return None
    channel = int(m.group(1))
    return (channel, "main" if m.group(2) == "1" else "sub") if 1 <= channel <= 256 else None


def link_ha_cameras(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    """entity id -> {recorder_id, channel, camera_id, profile} for every mirrored camera entity that is an NVR channel
    under the rule in the module docstring. Read-only, three small queries."""
    recorders = conn.execute("SELECT id, model FROM recorders").fetchall()
    by_slug: dict[str, list[str]] = {}
    for r in recorders:
        s = slug(r["model"])
        if s:
            by_slug.setdefault(s, []).append(r["id"])
    if not by_slug:
        return {}
    ents = conn.execute(
        "SELECT entity_id, device_id FROM ha_entities WHERE domain = 'camera' AND platform = ? AND removed_at IS NULL", (HIKVISION,)
    ).fetchall()
    cams = {(c["recorder_id"], int(c["channel"])): c["id"] for c in conn.execute("SELECT id, recorder_id, channel FROM cameras WHERE enabled = 1").fetchall()}
    out: dict[str, dict[str, Any]] = {}
    for model_slug, recorder_ids in by_slug.items():
        if len(recorder_ids) != 1:
            continue  # two recorders of one model: no way to tell which channels are whose
        recorder_id = recorder_ids[0]
        prefix = model_slug + "_"
        cand = []
        for e in ents:
            object_id = e["entity_id"].split(".", 1)[1]
            ch = channel_of(e["entity_id"]) if object_id.startswith(prefix) else None
            if ch:
                cand.append((e, ch))
        if len({e["device_id"] for e, _ in cand}) > 1:
            continue  # the model's entities span more than one registry device
        for e, (channel, profile) in cand:
            camera_id = cams.get((recorder_id, channel))
            if camera_id:
                out[e["entity_id"]] = {"recorder_id": recorder_id, "channel": channel, "camera_id": camera_id, "profile": profile}
    return out


def _names(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    """Every catalogue camera by id, named as the lists name it (a name two channels share is told apart by channel)."""
    from ..routers.anchors import camera_row
    from ..routers.cameras import disambiguate

    rows = disambiguate([camera_row(r) for r in conn.execute("SELECT * FROM cameras ORDER BY sort_order, channel").fetchall()])
    return {c["id"]: c for c in rows}


def _camera_by_channel(conn: sqlite3.Connection, recorder_id: str, channel: int) -> dict[str, Any] | None:
    row = conn.execute("SELECT id FROM cameras WHERE recorder_id = ? AND channel = ?", (recorder_id, channel)).fetchone()
    return _names(conn).get(row["id"]) if row else None


def _entity(conn: sqlite3.Connection, entity_id: str) -> dict[str, Any] | None:
    r = conn.execute(
        "SELECT entity_id, name, area_id, area_name, platform, state FROM ha_entities WHERE entity_id = ? AND domain = 'camera' AND removed_at IS NULL AND disabled = 0", (entity_id,)
    ).fetchone()
    return dict(r) if r else None


def entity_visible(conn: sqlite3.Connection, principal: Principal, entity_id: str) -> bool:
    """devices.read on the entity (installation-wide, or the floors it is placed on) - the rule of the device screens."""
    rows, _scoped = ha_scope.scoped_rows(conn, principal, READ, [{"entity_id": entity_id}])
    return bool(rows)


def can_still(conn: sqlite3.Connection, principal: Principal) -> bool:
    """A picture of a Home Assistant camera that is not an NVR channel has no camera scope to check it against: it needs
    video.live installation-wide (no floor- or camera-scoped grant reaches it) besides seeing the entity."""
    return authorize(conn, principal, LIVE, INSTALLATION).allowed


def _live_reply(kind: str, cam: dict[str, Any], **extra: Any) -> dict[str, Any]:
    return {"state": LIVE_STATE, "kind": kind, "camera_id": cam["id"], "recorder_id": cam["recorder_id"], "channel": cam["channel"], "name": cam["name"],
            "status": cam["status"], "encoding": cam["encoding"], **extra}


def _denied(conn: sqlite3.Connection, principal: Principal, camera_id: str, decision: Any) -> dict[str, Any]:
    audit(conn, actor=principal, action=LIVE, decision="denied", resource_type="camera", resource_id=camera_id, reason=decision.reason, under=decision)
    return {"state": FORBIDDEN}


def resolve(conn: sqlite3.Connection, principal: Principal, source: dict[str, Any], *, ha_live: bool = False) -> dict[str, Any]:
    """What one card shows for its source, for THIS caller. A caller who may not watch gets `{state: 'forbidden'}` and
    nothing else (no name, no id); a denied NVR camera is audited like a refused live view. `ha_live`: go2rtc is configured,
    so a standalone Home Assistant camera the owner enabled resolves to `ha_live` instead of `still_only`."""
    if source.get("kind") == "nvr":
        rid, channel = str(source.get("recorder_id") or ""), int(source.get("channel") or 0)
        row = conn.execute("SELECT id FROM cameras WHERE recorder_id = ? AND channel = ?", (rid, channel)).fetchone()
        camera_id = row["id"] if row else f"{rid}/{channel}"
        decision = camera_decision(conn, principal, camera_id, LIVE)
        if not decision.allowed:
            return _denied(conn, principal, camera_id, decision)
        cam = _camera_by_channel(conn, rid, channel)
        if cam is None:
            return {"state": MISSING}
        return _live_reply("nvr", cam) if cam["enabled"] else {"state": DISABLED, "kind": "nvr"}
    if source.get("kind") == "ha":
        entity_id = str(source.get("entity_id") or "")
        if not HA_CAMERA_RE.fullmatch(entity_id) or not entity_visible(conn, principal, entity_id):
            return {"state": FORBIDDEN}
        ent = _entity(conn, entity_id)
        if ent is None:
            return {"state": MISSING}
        link = link_ha_cameras(conn).get(entity_id)
        if link:
            decision = camera_decision(conn, principal, link["camera_id"], LIVE)
            if not decision.allowed:
                return _denied(conn, principal, link["camera_id"], decision)
            cam = _names(conn).get(link["camera_id"])
            if cam is None:
                return {"state": MISSING}
            return _live_reply("ha", cam, entity_id=entity_id, profile_hint=link["profile"])
        if not can_still(conn, principal):
            return {"state": FORBIDDEN}
        reply = {"kind": "ha", "entity_id": entity_id, "name": ent["name"] or entity_id, "status": "online" if ent["state"] not in ("unavailable", "unknown", None) else "offline"}
        from . import ha_camera_streams as hls

        if ha_live and hls.is_enabled(conn, entity_id):
            # the owner chose to show this camera live (ha_camera_streams): the same viewing rule as its picture, played
            # through the live relay at `live_path`; the picture stays the fallback if the stream does not come up
            return {"state": HA_LIVE, **reply, "live_path": hls.live_path(entity_id)}
        return {"state": STILL_ONLY, **reply}
    return {"state": MISSING}


def eligible(conn: sqlite3.Connection, principal: Principal, *, ha_live_ready: bool = False) -> dict[str, Any]:
    """The cameras this caller may offer in a card: NVR channels they may watch (grouped by recorder, catalogue order) and
    the Home Assistant cameras they may see - each with how it will play. Nothing they may not watch is named.
    `ha_live` says whether the live option of a standalone camera can be used at all (go2rtc configured: `ready`) and by this
    caller (`sources.configure`: `can_configure`); each such camera says whether the owner enabled it (`live_enabled`)."""
    from . import ha_camera_streams as hls

    live_on = hls.enabled(conn) if ha_live_ready else {}
    scope = camera_scope(conn, principal, LIVE)
    names = _names(conn)
    recorders = {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM recorders").fetchall()}
    linked = link_ha_cameras(conn)
    by_camera = {v["camera_id"]: eid for eid, v in linked.items() if v["profile"] == "main"}  # the entity of the main stream names the channel
    groups: dict[str, dict[str, Any]] = {}
    for cam in names.values():
        if not cam["enabled"] or not scope.allows(cam["id"]):
            continue
        g = groups.setdefault(cam["recorder_id"], {"recorder_id": cam["recorder_id"], "name": recorders.get(cam["recorder_id"]) or cam["recorder_id"], "cameras": []})
        g["cameras"].append({"recorder_id": cam["recorder_id"], "channel": cam["channel"], "camera_id": cam["id"], "name": cam["name"], "status": cam["status"], "entity_id": by_camera.get(cam["id"])})
    rows, _scoped = ha_scope.scoped_rows(conn, principal, READ, [e for e in svc.load_entities(conn) if e["domain"] == "camera"])
    still_ok = can_still(conn, principal)
    ha = []
    for e in rows:
        link = linked.get(e["entity_id"])
        if link:
            if not scope.allows(link["camera_id"]):
                continue
            ha.append({"entity_id": e["entity_id"], "name": e["name"] or e["entity_id"], "area_id": e.get("area_id"), "area_name": e.get("area_name"), "mode": LIVE_STATE, "recorder_id": link["recorder_id"], "channel": link["channel"]})
        elif still_ok:
            ha.append({"entity_id": e["entity_id"], "name": e["name"] or e["entity_id"], "area_id": e.get("area_id"), "area_name": e.get("area_name"), "mode": STILL_ONLY, "recorder_id": None, "channel": None,
                       "live_enabled": e["entity_id"] in live_on})
    ha.sort(key=lambda x: (x["name"], x["entity_id"]))
    can_configure = ha_live_ready and authorize(conn, principal, "sources.configure", INSTALLATION).allowed
    return {"recorders": list(groups.values()), "ha_cameras": ha, "ha_live": {"ready": ha_live_ready, "can_configure": can_configure}}
