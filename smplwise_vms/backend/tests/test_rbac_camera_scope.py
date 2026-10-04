"""Camera scope, session downgrade and scoped audit (T055, docs/security/HA_IDENTITY_RBAC_HE.md §15).

1. Precedence: a camera's chain is camera → every floor it is anchored on → building → site → installation; an allow
   anywhere on it grants, a deny anywhere on it wins (a narrower deny beats a wider allow and a wider deny beats a
   narrower allow), and bindings on another camera or floor never reach it. The batched camera scope agrees with the
   per-camera decision for every camera.
2. Every camera-bearing resource, asked by a user bound to ONE camera, serves that camera and refuses or filters the
   others - one parametrised list so nothing is missed.
3. Delegation: a delegated site administrator binds camera scope only for cameras wholly inside their subtree.
4. Session downgrade: a revoke is refused on the next call, ends the open live relay (lease closed), closes the
   playback session and cancels the export of the lost camera only, and /me/ws pushes `permissions_changed`.
5. Audit rows carry the binding, role and scope they were authorised under; audit reading stays restricted."""
from __future__ import annotations

import asyncio
import datetime as dt
import json
from dataclasses import replace
from pathlib import Path
from typing import Any, Callable

import pytest
from conftest import as_user, png_bytes, seed_tree
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from smplwise.config import Settings
from smplwise.db import Database, new_id, now_iso, permission_revision
from smplwise.main import create_app
from smplwise.rbac import Principal, authorize
from smplwise.services import ha_sync
from smplwise.services import playback as pb
from smplwise.services.access import camera_scope

LEVELS = ("installation", "site", "building", "floor", "camera")


def _settings(path: Path, **kw: Any) -> Settings:
    base = Settings(
        data_dir=path / "data", www_dir=None, in_addon=False, trusted_proxies=("172.30.32.2",), dev_user="joni", bootstrap_admin_username="joni",
        nvr_host="nvr-placeholder.test", nvr_http_port=80, nvr_user=None, nvr_password=None, go2rtc_url=None, log_level="warning", max_upload_bytes=5 * 1024 * 1024,
        max_pdf_pages=5, max_render_px=800, preview_px=300,
    )
    return replace(base, **kw)


def _binding(settings: Settings, user: str, role: str, scope_type: str, scope_id: str, effect: str = "allow") -> str:
    bid = new_id()
    with Database(settings.db_path).connection() as conn:
        conn.execute(
            "INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) VALUES (?, 'user', ?, ?, ?, ?, ?, ?, 'test', ?)",
            (bid, f"dev-{user}", role, scope_type, scope_id, effect, permission_revision(conn), now_iso()),
        )
    return bid


def _event(app, eid: str, camera_id: str | None) -> None:
    occurred = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%SZ")
    with app.state.db.connection() as conn:
        conn.execute(
            "INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (eid, "alertstream", "VMD", "motion", camera_id, 1, occurred, None, occurred, "inactive", 1, "info", "measured", json.dumps({}), f"t:{eid}", occurred),
        )


def _publish(c: TestClient, floor_id: str) -> str:
    asset = c.post(f"/api/v1/floors/{floor_id}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{floor_id}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    return v["id"]


def _anchor(c: TestClient, floor_id: str, kind: str, rid: str) -> None:
    assert c.post(f"/api/v1/floors/{floor_id}/anchors", json={"resource_type": kind, "resource_id": rid, "x": 0.4, "y": 0.4}).status_code == 201


def _world(settings: Settings) -> dict[str, Any]:
    """Two sites. Site A: floor 2 (cam2, cam_split, a light), floor 3 (cam3). Site B: floor B1 (cam_far, cam_split).
    cam_free is on no map. Events e2 / e3 / efar; a case with e2 and e3."""
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    site_b = c.post("/api/v1/sites", json={"name": "אתר ב"}).json()["id"]
    bld_b = c.post(f"/api/v1/sites/{site_b}/buildings", json={"name": "מבנה ב"}).json()["id"]
    floor_b = c.post(f"/api/v1/buildings/{bld_b}/floors", json={"name": "קומה ב1", "level": 1}).json()["id"]
    cams = {k: c.post("/api/v1/cameras", json={"channel": n, "alias": k}).json()["id"] for n, k in enumerate(("cam2", "cam3", "cam_far", "cam_free", "cam_split"), 1)}
    versions = {f: _publish(c, f) for f in (ids["floor2"], ids["floor3"], floor_b)}
    with app.state.db.connection() as conn:
        ha_sync.upsert_state(conn, {"entity_id": "light.lobby", "state": "on", "last_changed": "2026-09-20T09:00:00+00:00", "attributes": {"friendly_name": "תאורת לובי"}})
    _anchor(c, ids["floor2"], "camera", cams["cam2"])
    _anchor(c, ids["floor2"], "camera", cams["cam_split"])
    _anchor(c, ids["floor2"], "ha_entity", "light.lobby")
    _anchor(c, ids["floor3"], "camera", cams["cam3"])
    _anchor(c, floor_b, "camera", cams["cam_far"])
    _anchor(c, floor_b, "camera", cams["cam_split"])
    for eid, cam in (("e2", "cam2"), ("e3", "cam3"), ("efar", "cam_far")):
        _event(app, eid, cams[cam])
    _event(app, "esys", None)  # a camera-less event (storage / system): follows the installation grant
    case = c.post("/api/v1/cases", json={"title": "היקף מצלמה"}).json()["id"]
    for eid in ("e2", "e3"):
        assert c.post(f"/api/v1/cases/{case}/items", json={"kind": "event", "event_id": eid}).status_code == 201
    # a second case with stored snapshots of cam2 and cam3, and rule alerts: camera-less, cam2, cam3
    snap_case = c.post("/api/v1/cases", json={"title": "תמונות"}).json()["id"]
    now = now_iso()
    snaps = {}
    with app.state.db.connection() as conn:
        for cam in ("cam2", "cam3"):
            iid = new_id()
            rel = f"cases/{snap_case}/{iid}.jpg"
            (settings.data_dir / rel).parent.mkdir(parents=True, exist_ok=True)
            (settings.data_dir / rel).write_bytes(b"\xff\xd8\xff\xe0" + b"\x00" * 32)
            conn.execute("INSERT INTO case_items(id, case_id, kind, camera_id, from_at, to_at, added_by, created_at, file_path, file_sha256) VALUES (?,?,?,?,?,?,?,?,?,?)",
                         (iid, snap_case, "snapshot", cams[cam], now, now, "dev-joni", now, rel, "0" * 64))
            snaps[cam] = iid
        conn.execute("INSERT INTO rules(id, name, trigger_json, scope_json, window_json, actions_json, created_at, updated_at) VALUES ('r1', 'בדיקה', '{}', '{}', '{}', '[]', ?, ?)", (now, now))
        for aid, eid, cam in (("a-sys", "esys", None), ("a2", "e2", cams["cam2"]), ("a3", "e3", cams["cam3"])):
            conn.execute("INSERT INTO rule_alerts(id, rule_id, event_id, camera_id, fired_at, occurred_at, reasons_json) VALUES (?, 'r1', ?, ?, ?, ?, '[]')", (aid, eid, cam, now, now))
    return {"app": app, "c": c, "settings": settings, **ids, "site_b": site_b, "building_b": bld_b, "floor_b": floor_b, "cams": cams, "versions": versions, "case": case,
            "snap_case": snap_case, "snaps": snaps}


@pytest.fixture(scope="module")
def world(tmp_path_factory) -> dict[str, Any]:
    return _world(_settings(tmp_path_factory.mktemp("camscope")))


def _scope_id(w: dict[str, Any], level: str) -> str:
    return {"installation": "*", "site": w["site"], "building": w["building"], "floor": w["floor2"], "camera": w["cams"]["cam2"]}[level]


# ---------------------------------------------------------------- 1. precedence matrix

@pytest.mark.parametrize("deny_at", (None,) + LEVELS)
@pytest.mark.parametrize("allow_at", (None,) + LEVELS)
def test_precedence_matrix(world, allow_at, deny_at):
    w, c, cams = world, world["c"], world["cams"]
    user = f"m-{allow_at or 'none'}-{deny_at or 'none'}"
    c.get("/api/v1/me", headers=as_user(user))
    if allow_at:
        _binding(w["settings"], user, "operator", allow_at, _scope_id(w, allow_at))
    if deny_at:
        _binding(w["settings"], user, "operator", deny_at, _scope_id(w, deny_at), effect="deny")
    expect_cam2 = allow_at is not None and deny_at is None
    # cam3 sits on floor 3 of the same building: only the installation / site / building bindings reach it
    wide = ("installation", "site", "building")
    expect_cam3 = allow_at in wide and deny_at not in wide
    h = as_user(user)
    assert (c.get(f"/api/v1/media/live/{cams['cam2']}", headers=h).status_code == 200) is expect_cam2
    assert (c.get(f"/api/v1/media/live/{cams['cam3']}", headers=h).status_code == 200) is expect_cam3
    listed = {x["id"] for x in c.get("/api/v1/cameras", headers=h).json().get("cameras", [])}
    assert (cams["cam2"] in listed) is expect_cam2 and (cams["cam3"] in listed) is expect_cam3
    p = Principal(f"dev-{user}", user, user, "dev")
    with Database(w["settings"].db_path).connection(mode="read") as conn:
        scope = camera_scope(conn, p, "video.live")
        for cid in cams.values():  # the batched scope and the per-camera decision never disagree
            assert scope.allows(cid) is authorize(conn, p, "video.live", ("camera", cid)).allowed, cid
        if deny_at and allow_at:
            d = authorize(conn, p, "video.live", ("camera", cams["cam2"]))
            assert d.reason == "explicit_deny" and d.scope == (deny_at, _scope_id(w, deny_at))


def test_camera_on_two_floors_and_unanchored(world):
    """cam_split hangs on floor 2 (site A) and floor B1 (site B): either floor's allow reaches it, either floor's deny
    takes it away; cam_free (no map) is reached by the installation or its own binding only."""
    w, c, cams = world, world["c"], world["cams"]
    for user, binds, split, free in (
        ("s-b1", [("floor", w["floor_b"], "allow")], True, False),
        ("s-b1-deny2", [("floor", w["floor_b"], "allow"), ("floor", w["floor2"], "deny")], False, False),
        ("s-site", [("site", w["site"], "allow")], True, False),
        ("s-inst", [("installation", "*", "allow")], True, True),
        ("s-free", [("camera", cams["cam_free"], "allow")], False, True),
    ):
        c.get("/api/v1/me", headers=as_user(user))
        for st, sid, eff in binds:
            _binding(w["settings"], user, "viewer", st, sid, effect=eff)
        h = as_user(user)
        assert (c.get(f"/api/v1/media/live/{cams['cam_split']}", headers=h).status_code == 200) is split, user
        assert (c.get(f"/api/v1/media/live/{cams['cam_free']}", headers=h).status_code == 200) is free, user


# ---------------------------------------------------------------- 2. every camera-bearing resource
#
# Two personas run through the SAME list (security review B2: the second was the missing case):
#   scoped - operator bound to cam2 alone (a camera binding)
#   wide   - operator bound installation-wide AND denied (operator) on cam3
# Each check asserts cam2 is served and cam3 is refused or filtered; `wide` adds what an installation reader keeps
# (other cameras, camera-less events and alerts - review M3).

def _ws_close_code(c: TestClient, url: str, h: dict[str, str]) -> int:
    with pytest.raises(WebSocketDisconnect) as ei:
        with c.websocket_connect(url, headers=dict(h)) as ws:  # the client adds upgrade headers to the dict it is given
            ws.receive_text()
    return ei.value.code


def _today() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")


# (name, check(c, h, w, cams, wide))
RESOURCES: list[tuple[str, Callable[..., None]]] = []


def resource(name: str):
    def deco(fn):
        RESOURCES.append((name, fn))
        return fn
    return deco


def _others(cams: dict[str, str]) -> set[str]:
    return {v for k, v in cams.items() if k != "cam3"}


@resource("camera list")
def _(c, h, w, cams, wide):
    got = {x["id"] for x in c.get("/api/v1/cameras", headers=h).json()["cameras"]}
    assert got == (_others(cams) if wide else {cams["cam2"]})


@resource("snapshot")
def _(c, h, w, cams, wide):
    assert c.get(f"/api/v1/cameras/{cams['cam3']}/snapshot.jpg", headers=h).status_code == 403
    assert c.get(f"/api/v1/cameras/{cams['cam2']}/snapshot.jpg", headers=h).status_code != 403  # the NVR is not configured here


@resource("live info")
def _(c, h, w, cams, wide):
    got = [c.get(f"/api/v1/media/live/{cams[k]}", headers=h).status_code for k in ("cam2", "cam3", "cam_split", "cam_free")]
    assert got == ([200, 403, 200, 200] if wide else [200, 403, 403, 403])


@resource("live socket")
def _(c, h, w, cams, wide):
    assert _ws_close_code(c, f"/api/v1/media/live/{cams['cam3']}/ws?profile=sub", h) == 4403
    assert _ws_close_code(c, f"/api/v1/media/live/{cams['cam2']}/ws?profile=sub", h) == 4503  # authorised; go2rtc is not configured


@resource("recordings")
def _(c, h, w, cams, wide):
    assert c.get(f"/api/v1/cameras/{cams['cam3']}/recordings?date={_today()}", headers=h).status_code == 403
    assert c.get(f"/api/v1/cameras/{cams['cam2']}/recordings?date={_today()}", headers=h).status_code != 403


@resource("recording frame")
def _(c, h, w, cams, wide):
    assert c.get(f"/api/v1/cameras/{cams['cam3']}/frame?at=2026-09-20T10:00:00Z", headers=h).status_code == 403
    assert c.get(f"/api/v1/cameras/{cams['cam2']}/frame?at=2026-09-20T10:00:00Z", headers=h).status_code != 403


@resource("playback session")
def _(c, h, w, cams, wide):
    body = {"start_at": "2026-09-20T10:00:00Z"}
    assert c.post("/api/v1/playback/sessions", json={**body, "camera_id": cams["cam3"]}, headers=h).status_code == 403
    assert c.post("/api/v1/playback/sessions", json={**body, "camera_id": cams["cam2"]}, headers=h).json()["code"] == "no_track"


@resource("playback group")
def _(c, h, w, cams, wide):
    assert c.post("/api/v1/playback/groups", json={"camera_ids": [cams["cam2"], cams["cam3"]], "start_at": "2026-09-20T10:00:00Z"}, headers=h).status_code == 403


@resource("events list")
def _(c, h, w, cams, wide):
    assert {e["id"] for e in c.get("/api/v1/events", headers=h).json()["events"]} == ({"e2", "efar", "esys"} if wide else {"e2"})


@resource("event facets")
def _(c, h, w, cams, wide):
    f = c.get("/api/v1/events/facets", headers=h).json()
    assert sum(t["count"] for t in f["types"]) == (3 if wide else 1)
    floors = {fl["id"]: fl for s in f["places"] for b in s["buildings"] for fl in b["floors"]}
    assert floors[w["floor2"]]["cameras"] == (2 if wide else 1) and floors.get(w["floor3"], {"cameras": 0})["cameras"] == 0
    assert (w["floor_b"] in floors) is wide, "places are limited to the caller's reach"


@resource("event summary")
def _(c, h, w, cams, wide):
    assert c.get("/api/v1/events/summary", headers=h).json()["today"]["total"] <= (3 if wide else 1)  # never e3


@resource("review windows")
def _(c, h, w, cams, wide):
    assert c.get("/api/v1/events/windows", headers=h).json()["events_total"] == (3 if wide else 1)


@resource("camera timeline")
def _(c, h, w, cams, wide):
    assert c.get(f"/api/v1/cameras/{cams['cam3']}/events?date={_today()}", headers=h).status_code == 403
    assert c.get(f"/api/v1/cameras/{cams['cam2']}/events?date={_today()}", headers=h).status_code == 200
    assert c.get(f"/api/v1/cameras/no-such-camera/events?date={_today()}", headers=h).status_code == (404 if wide else 403), "403 before 404"


@resource("event detail, thumbnail, correlation, route")
def _(c, h, w, cams, wide):
    for tail in ("", "/thumbnail", "/correlation", "/route"):
        assert c.get(f"/api/v1/events/e3{tail}", headers=h).status_code == 403, tail
    assert c.get("/api/v1/events/e2", headers=h).status_code == 200
    assert c.get("/api/v1/events/esys", headers=h).status_code == (200 if wide else 403)


@resource("event acknowledgement")
def _(c, h, w, cams, wide):
    r = c.post("/api/v1/events/ack-many", json={"event_ids": ["e3", "e2"]}, headers=h).json()
    assert r["acked"] == ["e2"] and r["skipped"] == ["e3"]
    assert c.post("/api/v1/events/e3/ack", headers=h).status_code == 403


@resource("rule alerts")
def _(c, h, w, cams, wide):
    got = {a["id"] for a in c.get("/api/v1/rules/alerts", headers=h).json()["alerts"]}
    assert got == ({"a2", "a-sys"} if wide else {"a2"})
    assert c.post("/api/v1/rules/alerts/a3/ack", headers=h).status_code == 403


@resource("case items and stored snapshots")
def _(c, h, w, cams, wide):
    case = c.get(f"/api/v1/cases/{w['case']}?check=false", headers=h).json()
    assert [i["camera_id"] for i in case["items"]] == [cams["cam2"]] and case["hidden_items"] == 1
    assert c.get(f"/api/v1/cases/{w['snap_case']}/items/{w['snaps']['cam3']}/file", headers=h).status_code == 403
    assert c.get(f"/api/v1/cases/{w['snap_case']}/items/{w['snaps']['cam2']}/file", headers=h).status_code == 200


@resource("case bundle download")
def _(c, h, w, cams, wide):
    built = w["c"].post(f"/api/v1/cases/{w['case']}/bundle")
    assert built.status_code == 201, built.text
    assert c.get(f"/api/v1/cases/{w['case']}/bundles/{built.json()['name']}", headers=h).status_code == 403, "the ZIP holds cam3's item too"


@resource("export create and download")
def _(c, h, w, cams, wide):
    body = {"from_at": "2026-09-20T10:00:00Z", "to_at": "2026-09-20T10:05:00Z"}
    assert c.post("/api/v1/exports/estimate", json={**body, "camera_id": cams["cam3"]}, headers=h).status_code == 403
    assert c.post("/api/v1/exports/estimate", json={**body, "camera_id": cams["cam2"]}, headers=h).json()["code"] == "no_track"
    job = _job(w, h["X-SW-Dev-User"], cams["cam3"], "done")
    assert c.get(f"/api/v1/exports/{job}/download", headers=h).status_code == 403


@resource("PTZ / capabilities and detection zones")
def _(c, h, w, cams, wide):
    for tail in ("capabilities", "zones"):
        assert c.get(f"/api/v1/cameras/{cams['cam3']}/{tail}", headers=h).status_code == 403
        assert c.get(f"/api/v1/cameras/{cams['cam2']}/{tail}", headers=h).status_code != 403
    assert c.get("/api/v1/cameras/no-such-camera/capabilities", headers=h).status_code == (404 if wide else 403), "403 before 404"


@resource("camera settings (manual record state)")
def _(c, h, w, cams, wide):
    assert c.get(f"/api/v1/cameras/{cams['cam3']}/record", headers=h).status_code == 403
    assert c.get(f"/api/v1/cameras/{cams['cam2']}/record", headers=h).status_code == 200


@resource("floor map bundle")
def _(c, h, w, cams, wide):
    m = c.get(f"/api/v1/floors/{w['floor2']}/map", headers=h).json()
    cam_anchors = sorted(a["resource_id"] for a in m["anchors"] if a["resource_type"] == "camera")
    if wide:
        assert m["reach"] == "floor" and cam_anchors == sorted([cams["cam2"], cams["cam_split"]]) and any(a["resource_type"] == "ha_entity" for a in m["anchors"])
        m3 = c.get(f"/api/v1/floors/{w['floor3']}/map", headers=h).json()
        assert m3["reach"] == "floor" and not [a for a in m3["anchors"] if a["resource_type"] == "camera"], "the denied camera is not in the bundle"
        assert cams["cam3"] not in {x["id"] for x in m3["cameras"]}
    else:
        assert m["reach"] == "cameras" and [a["resource_id"] for a in m["anchors"]] == [cams["cam2"]], "no cam_split, no light"
        assert [x["id"] for x in m["cameras"]] == [cams["cam2"]] and m["zones"] == [] and m["circuit_states"] == {}
        assert not any(m["permissions"].values())
        assert c.get(f"/api/v1/floors/{w['floor3']}/map", headers=h).status_code == 403
        assert c.get(f"/api/v1/floors/{w['floor_b']}/map", headers=h).status_code == 403
        assert c.get(f"/api/v1/floors/{w['floor2']}/anchors", headers=h).status_code == 403, "the raw anchor list stays floor-scoped"


@resource("sites tree and plan image")
def _(c, h, w, cams, wide):
    tree = c.get("/api/v1/sites", headers=h).json()["sites"]
    floors = {f["id"] for s in tree for b in s["buildings"] for f in b["floors"]}
    assert floors == ({w["floor2"], w["floor3"], w["floor_b"]} if wide else {w["floor2"]})
    assert c.get(f"/api/v1/plan-versions/{w['versions'][w['floor2']]}/image.png", headers=h).status_code == 200
    assert c.get(f"/api/v1/plan-versions/{w['versions'][w['floor3']]}/image.png", headers=h).status_code == (200 if wide else 403)


@resource("search")
def _(c, h, w, cams, wide):
    found = {r["id"] for r in c.get("/api/v1/search?q=cam&limit=20", headers=h).json()["results"] if r["kind"] == "camera"}
    assert found == (_others(cams) if wide else {cams["cam2"]})


@resource("saved views")
def _(c, h, w, cams, wide):
    views = [v for v in c.get("/api/v1/views", headers=h).json()["views"] if v["name"] == "כל המצלמות"]
    assert views and cams["cam3"] not in views[0]["cameras"] and cams["cam2"] in views[0]["cameras"]
    assert views[0]["hidden_cameras"] == (1 if wide else 4)


@resource("health per camera")
def _(c, h, w, cams, wide):
    body = c.get("/api/v1/health/summary", headers=h).text
    assert cams["cam3"] not in body and c.get("/api/v1/health/report", headers=h).status_code == 403


@resource("WisKey station cameras")
def _(c, h, w, cams, wide):
    # stations are not VMS cameras: access.read at camera scope reaches no station; installation-wide it does
    assert (c.get("/api/v1/intercom/overview", headers=h).status_code == 403) is not wide


def _job(w: dict[str, Any], user: str, camera_id: str, state: str) -> str:
    jid = new_id()
    now = now_iso()
    with Database(w["settings"].db_path).connection() as conn:
        conn.execute(
            "INSERT INTO export_jobs(id, owner_user_id, owner_username, camera_id, camera_name, requested_from, requested_to, state, progress, payload_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (jid, f"dev-{user}", user, camera_id, "x", "2026-09-20T10:00:00Z", "2026-09-20T10:05:00Z", state, 1.0 if state == "done" else 0.0, "{}", now, now),
        )
    return jid


@pytest.fixture(scope="module")
def personas(world) -> dict[str, dict[str, str]]:
    c, cams = world["c"], world["cams"]
    for user in ("scoped", "widedeny"):
        c.get("/api/v1/me", headers=as_user(user))
    _binding(world["settings"], "scoped", "operator", "camera", cams["cam2"])
    _binding(world["settings"], "widedeny", "operator", "installation", "*")
    _binding(world["settings"], "widedeny", "operator", "camera", cams["cam3"], effect="deny")
    assert c.post("/api/v1/views", json={"name": "כל המצלמות", "cameras": list(cams.values()), "shared": True}).status_code == 201
    return {"scoped": as_user("scoped"), "wide": as_user("widedeny")}


@pytest.mark.parametrize("persona", ("scoped", "wide"))
@pytest.mark.parametrize("name,check", RESOURCES, ids=[n for n, _ in RESOURCES])
def test_every_camera_resource_is_filtered(world, personas, persona, name, check):
    check(world["c"], dict(personas[persona]), world, world["cams"], persona == "wide")


def test_camera_scoped_me_and_navigation(world, personas):
    me = world["c"].get("/api/v1/me", headers=personas["scoped"]).json()
    assert me["permissions_installation"] == [] and {"video.live", "events.read", "map.read"} <= set(me["permissions_any"])
    assert [b["scope_type"] for b in me["bindings"]] == ["camera"] and me["bindings"][0]["scope_name"] == "מצלמה · cam2"


def test_camera_settings_follow_a_camera_deny(world):
    """NVR settings stay an installation-wide grant; a deny on one camera takes that camera's settings away."""
    w, c, cams = world, world["c"], world["cams"]
    c.get("/api/v1/me", headers=as_user("nadia"))
    _binding(w["settings"], "nadia", "system_admin", "installation", "*")
    _binding(w["settings"], "nadia", "system_admin", "camera", cams["cam3"], effect="deny")
    h = as_user("nadia")
    for tail in ("osd", "schedules", "smart", "record"):
        assert c.get(f"/api/v1/cameras/{cams['cam3']}/{tail}", headers=h).status_code == 403, tail
        assert c.get(f"/api/v1/cameras/{cams['cam2']}/{tail}", headers=h).status_code != 403, tail
    assert c.put(f"/api/v1/cameras/{cams['cam3']}/osd", json={"name_enabled": True}, headers=h).status_code == 403
    m = c.get(f"/api/v1/floors/{w['floor3']}/map", headers=h).json()
    assert m["reach"] == "floor" and not [a for a in m["anchors"] if a["resource_type"] == "camera"], "the denied camera is not in the bundle"
    assert cams["cam3"] not in {x["id"] for x in m["cameras"]}, "nor in the editor's camera list"


# ---------------------------------------------------------------- placement reach (review B1, M1), camera denies of admin roles (M2)

def test_placing_moving_and_removing_a_camera_needs_reach(tmp_path):
    settings = _settings(tmp_path)
    w = _world(settings)
    c, cams = w["c"], w["cams"]
    for u in ("eve", "vic"):
        c.get("/api/v1/me", headers=as_user(u))
    _binding(settings, "eve", "editor", "floor", w["floor2"])
    _binding(settings, "vic", "viewer", "floor", w["floor2"])
    h = as_user("eve")
    body = {"resource_type": "camera", "x": 0.7, "y": 0.7}
    # create: a camera of another site, on no map, or on another floor is not hers to put on floor 2
    for key in ("cam_far", "cam_free", "cam3"):
        assert c.post(f"/api/v1/floors/{w['floor2']}/anchors", json={**body, "resource_id": cams[key]}, headers=h).status_code == 403, key
    assert c.get(f"/api/v1/media/live/{cams['cam_far']}", headers=as_user("vic")).status_code == 403, "the floor-2 viewer gained nothing"
    # the editor's camera list: only the cameras she reaches
    m = c.get(f"/api/v1/floors/{w['floor2']}/map", headers=h).json()
    assert m["permissions"]["edit"] and {x["id"] for x in m["cameras"]} == {cams["cam2"], cams["cam_split"]}
    # move: a camera she reaches, yes; one explicitly denied to her, neither moved nor taken off the floor
    a2 = next(a for a in m["anchors"] if a["resource_id"] == cams["cam2"])
    assert c.patch(f"/api/v1/map-anchors/{a2['id']}", json={"revision": a2["revision"], "x": 0.2}, headers=h).status_code == 200
    _binding(settings, "eve", "editor", "camera", cams["cam_split"], effect="deny")
    split = next(a for a in m["anchors"] if a["resource_id"] == cams["cam_split"])
    assert c.patch(f"/api/v1/map-anchors/{split['id']}", json={"revision": split["revision"], "x": 0.1}, headers=h).status_code == 403
    assert c.delete(f"/api/v1/map-anchors/{split['id']}", headers=h).status_code == 403
    assert cams["cam_split"] not in {x["id"] for x in c.get(f"/api/v1/floors/{w['floor2']}/map", headers=h).json()["cameras"]}
    # re-review probe: reading a camera is not reach for placing it - vic edits floor 2 and VIEWS cam_far (site B)
    c.get("/api/v1/me", headers=as_user("vic2"))
    _binding(settings, "vic2", "editor", "floor", w["floor2"])
    _binding(settings, "vic2", "viewer", "camera", cams["cam_far"])
    assert c.get(f"/api/v1/media/live/{cams['cam_far']}", headers=as_user("vic2")).status_code == 200
    assert c.post(f"/api/v1/floors/{w['floor2']}/anchors", json={**body, "resource_id": cams["cam_far"]}, headers=as_user("vic2")).status_code == 403
    m_vic = c.get(f"/api/v1/floors/{w['floor2']}/map", headers=as_user("vic2")).json()
    assert {x["id"] for x in m_vic["cameras"]} == {cams["cam2"], cams["cam_split"]}, "the editor's list: placement reach only"
    # someone holding placement.edit on cam_far's chain (an editor of floor B1) may bring it to floor 2 as well
    c.get("/api/v1/me", headers=as_user("sue"))
    _binding(settings, "sue", "editor", "floor", w["floor2"])
    _binding(settings, "sue", "editor", "floor", w["floor_b"])
    assert c.post(f"/api/v1/floors/{w['floor2']}/anchors", json={**body, "resource_id": cams["cam_far"]}, headers=as_user("sue")).status_code == 201
    # an installation-wide placement editor (the system administrator) places any camera, even one on no map
    assert c.post(f"/api/v1/floors/{w['floor2']}/anchors", json={**body, "resource_id": cams["cam_free"]}).status_code == 201


def test_anchor_placed_on_a_new_floor_after_binding(tmp_path):
    """M1 ruling (§15): a camera-only user gets the drawing of every floor the camera is anchored on; a new floor comes
    only from someone who already reaches the camera (B1) - a floor editor who does not is refused."""
    settings = _settings(tmp_path)
    w = _world(settings)
    c, cams = w["c"], w["cams"]
    for u in ("mia", "fay"):
        c.get("/api/v1/me", headers=as_user(u))
    _binding(settings, "mia", "viewer", "camera", cams["cam2"])
    _binding(settings, "fay", "editor", "floor", w["floor3"])
    assert c.get(f"/api/v1/floors/{w['floor3']}/map", headers=as_user("mia")).status_code == 403
    r = c.post(f"/api/v1/floors/{w['floor3']}/anchors", json={"resource_type": "camera", "resource_id": cams["cam2"], "x": 0.5, "y": 0.5}, headers=as_user("fay"))
    assert r.status_code == 403
    assert c.get(f"/api/v1/floors/{w['floor3']}/map", headers=as_user("mia")).status_code == 403, "a floor editor cannot widen mia's reach"
    assert c.post(f"/api/v1/floors/{w['floor3']}/anchors", json={"resource_type": "camera", "resource_id": cams["cam2"], "x": 0.5, "y": 0.5}).status_code == 201
    m = c.get(f"/api/v1/floors/{w['floor3']}/map", headers=as_user("mia")).json()
    assert m["reach"] == "cameras" and [a["resource_id"] for a in m["anchors"]] == [cams["cam2"]], "placed by someone who reached it: documented"


def test_full_admin_denies_admin_roles_on_one_camera(tmp_path):
    settings = _settings(tmp_path)
    w = _world(settings)
    c, cams = w["c"], w["cams"]
    c.get("/api/v1/me", headers=as_user("nadia"))
    _binding(settings, "nadia", "system_admin", "installation", "*")
    body = {"subject_kind": "user", "subject_id": "dev-nadia", "scope_type": "camera", "scope_id": cams["cam3"]}
    for role in ("system_admin", "site_admin"):
        r = c.post("/api/v1/access/bindings", json={**body, "role_id": role, "effect": "deny"})
        assert r.status_code == 201, r.text
        assert c.post("/api/v1/access/bindings", json={**body, "role_id": role}).json()["code"] == "scope_not_allowed_for_role"
    h = as_user("nadia")
    assert c.get(f"/api/v1/media/live/{cams['cam3']}", headers=h).status_code == 403
    assert c.get(f"/api/v1/media/live/{cams['cam2']}", headers=h).status_code == 200


def test_audit_grant_is_the_one_behind_the_action():
    import contextvars

    from smplwise import rbac
    from smplwise.rbac import INSTALLATION, Decision

    def run() -> None:
        cam = Decision(True, "binding", "b1", "operator", ("camera", "c1"))
        inst = Decision(True, "binding", "b2", "system_admin", INSTALLATION)
        rbac.note_grant(cam, "video.export")
        rbac.note_grant(inst, "sources.configure")
        assert rbac.last_grant("video.export.create") is cam, "the export row names the export grant, not the later one"
        assert rbac.last_grant("sources.configure") is inst
        assert rbac.last_grant("camera.update") is inst  # no permission of that name: the latest grant

    contextvars.copy_context().run(run)
    assert rbac.last_grant() is None, "nothing leaks out of a request's context"


# ---------------------------------------------------------------- 3. delegation

def test_delegated_camera_bindings(tmp_path):
    settings = _settings(tmp_path)
    w = _world(settings)
    c, cams = w["c"], w["cams"]
    c.get("/api/v1/me", headers=as_user("sara"))
    c.get("/api/v1/me", headers=as_user("tom"))
    _binding(settings, "sara", "site_admin", "site", w["site"])
    h = as_user("sara")
    body = {"subject_kind": "user", "subject_id": "dev-tom", "role_id": "viewer", "scope_type": "camera"}
    r = c.post("/api/v1/access/bindings", json={**body, "scope_id": cams["cam2"]}, headers=h)
    assert r.status_code == 201, r.text
    assert r.json()["scope_name"] == "מצלמה · cam2"
    assert c.post("/api/v1/access/bindings", json={**body, "scope_id": cams["cam_far"]}, headers=h).status_code == 403, "another site"
    assert c.post("/api/v1/access/bindings", json={**body, "scope_id": cams["cam_free"]}, headers=h).status_code == 403, "on no map: installation only"
    r = c.post("/api/v1/access/bindings", json={**body, "scope_id": cams["cam_split"]}, headers=h)
    assert r.status_code == 403 and r.json()["code"] == "delegation_camera_scope", "also hangs on a floor of site B"
    r = c.post("/api/v1/access/bindings", json={**body, "role_id": "operator", "scope_id": cams["cam3"]}, headers=h)
    assert r.status_code == 201, r.text  # operator is on the default delegation list and within sara's own permissions there
    assert c.post("/api/v1/access/bindings", json={**body, "role_id": "site_admin", "scope_id": cams["cam2"]}).json()["code"] == "scope_not_allowed_for_role", "no admin of one camera"
    assert c.post("/api/v1/access/bindings", json={**body, "effect": "deny", "scope_id": cams["cam2"]}, headers=h).json()["code"] == "delegation_deny_forbidden"
    assert c.post("/api/v1/access/bindings", json={**body, "scope_id": "no-such-camera"}).json()["code"] == "scope_unknown"
    # the picker offers exactly the cameras in reach
    scopes = c.get("/api/v1/identity/users", headers=h).json()["assign_scopes"]
    assert {s["id"] for s in scopes if s["type"] == "camera"} == {cams["cam2"], cams["cam3"]}
    admin_scopes = c.get("/api/v1/identity/users").json()["assign_scopes"]
    assert {s["id"] for s in admin_scopes if s["type"] == "camera"} == set(cams.values())
    # tom now sees the two cameras he was bound to and nothing else
    assert {x["id"] for x in c.get("/api/v1/cameras", headers=as_user("tom")).json()["cameras"]} == {cams["cam2"], cams["cam3"]}
    # a group bound to a camera outside sara's subtree is out of her reach (the groups' reach rule includes cameras)
    g = c.post("/api/v1/access/groups", json={"name": "שומרי חניה"}).json()
    assert c.post(f"/api/v1/access/groups/{g['id']}/bindings", json={"role_id": "viewer", "scope_type": "camera", "scope_id": cams["cam_far"], "revision": g["revision"]}).status_code == 201
    g = c.get("/api/v1/access/groups").json()["groups"]
    gid = next(x for x in g if x["name"] == "שומרי חניה")
    r = c.put(f"/api/v1/access/groups/{gid['id']}/members", json={"user_ids": ["dev-tom"], "revision": gid["revision"]}, headers=h)
    assert r.status_code == 403 and r.json()["code"] == "delegation_group_scope"
    # the impact preview names the camera-level effect
    imp = c.post(f"/api/v1/access/groups/{gid['id']}/impact", json={"op": "members", "user_ids": ["dev-tom"]}).json()
    row = next(u for u in imp["users"] if u["id"] == "dev-tom")
    assert [(s["scope_type"], s["scope_id"]) for s in imp["scopes"]] == [("camera", cams["cam_far"])]
    assert row["scopes"][0]["scope_name"] == "מצלמה · cam_far" and {"video.live", "map.read"} <= set(row["scopes"][0]["added"])


# ---------------------------------------------------------------- 4. session downgrade

def test_session_downgrade_refuses_and_closes_the_lease(tmp_path, monkeypatch):
    from smplwise.routers import media

    settings = _settings(tmp_path, go2rtc_url="http://go2rtc:1984")
    w = _world(settings)
    c, cams = w["c"], w["cams"]
    c.get("/api/v1/me", headers=as_user("cara"))
    h = as_user("cara")
    grant = c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-cara", "role_id": "operator", "scope_type": "camera", "scope_id": cams["cam2"]})
    assert grant.status_code == 201, grant.text
    _binding(settings, "cara", "operator", "floor", w["floor3"])  # cam3 stays hers throughout

    # the relay: tell the client it is up, then run until the lease says stop (the real relay polls every second)
    async def fake_relay(websocket, url, headers, on_down, should_stop=None, on_text=None):
        await websocket.send_text('{"type":"ready"}')
        # integ/0163 gate: a 10 s budget ran out in a loaded shard before the revoke reached the lease ("timeout" closes without
        # access_lost); 120 s is only a safety stop - the loop ends as soon as the lease says stop
        for _ in range(4800):
            if should_stop and should_stop():
                return "superseded"
            await asyncio.sleep(0.025)
        return "timeout"

    class FakeGo2rtc:
        def __init__(self, *_a, **_k):
            pass

        def ws_url(self, name):
            return f"ws://go2rtc/api/ws?src={name}"

        def ws_headers(self):
            return {}

    monkeypatch.setattr(media, "relay_ws", fake_relay)
    monkeypatch.setattr(media, "ensure_camera_stream", lambda _s, cam, profile: f"smplwise_nvr-1_ch{cam['channel']}_{profile}")
    monkeypatch.setattr(media.g2, "Go2rtc", FakeGo2rtc)
    monkeypatch.setattr(pb, "_create_stream", lambda _s, session, _start: setattr(session, "stream", f"smplwise_pb_{session.id}"))
    monkeypatch.setattr(pb, "_delete_stream", lambda _s, name: None)
    start = dt.datetime(2026, 9, 20, 8, 0, tzinfo=dt.timezone.utc)
    who = Principal("dev-cara", "cara", "cara", "dev")
    lost_pb = pb.create(settings, who, {"id": cams["cam2"], "channel": 1, "main_track": 101}, start, start + dt.timedelta(hours=1), "Asia/Jerusalem", 8)
    kept_pb = pb.create(settings, who, {"id": cams["cam3"], "channel": 2, "main_track": 201}, start, start + dt.timedelta(hours=1), "Asia/Jerusalem", 8)
    lost_job, kept_job = _job(w, "cara", cams["cam2"], "queued"), _job(w, "cara", cams["cam3"], "queued")
    done_job = _job(w, "cara", cams["cam2"], "done")

    known = c.get("/api/v1/me", headers=h).json()["permissions_fingerprint"]
    try:
        with c.websocket_connect("/api/v1/me/ws", headers=dict(h)) as me_ws, c.websocket_connect(f"/api/v1/media/live/{cams['cam2']}/ws?profile=sub", headers=dict(h)) as live:
            assert me_ws.receive_json()["type"] == "hello"
            assert live.receive_json() == {"type": "ready"}
            assert len([s for s in media.REGISTRY.sessions.values() if s.user_id == "dev-cara"]) == 1
            # revoke through the API, as an administrator would
            assert c.delete(f"/api/v1/access/bindings/{grant.json()['id']}").status_code == 200
            # the next request of the open session is refused - nothing cached beyond a request
            assert c.get(f"/api/v1/media/live/{cams['cam2']}", headers=h).status_code == 403
            assert c.get(f"/api/v1/media/live/{cams['cam3']}", headers=h).status_code == 200
            # the server ends the stream of the lost camera and closes its lease
            assert live.receive_json() == {"type": "error", "value": "access_lost"}
            with pytest.raises(WebSocketDisconnect) as ei:
                live.receive_text()
            assert ei.value.code == 4403
            # the shell's channel says what happened
            msg = me_ws.receive_json()
            assert msg["type"] == "permissions_changed" and msg["payload"]["permissions_fingerprint"] != known
    finally:
        pb.REGISTRY.sessions.clear()
    assert not [s for s in media.REGISTRY.sessions.values() if s.user_id == "dev-cara"], "the live lease is gone"
    assert lost_pb.state == "revoked" and kept_pb.state not in ("closed", "revoked", "expired"), "only the lost camera's playback closes"
    with Database(settings.db_path).connection(mode="read") as conn:
        states = {r["id"]: r["state"] for r in conn.execute("SELECT id, state FROM export_jobs").fetchall()}
        stop = conn.execute("SELECT details_json FROM audit_log WHERE action = 'video.live.stop' AND actor_user_id = 'dev-cara'").fetchone()
        cancel = conn.execute("SELECT reason FROM audit_log WHERE action = 'video.export.cancel' AND resource_id = ?", (cams["cam2"],)).fetchone()
    assert states[lost_job] == "cancelled" and states[kept_job] == "queued", "a running export of the lost camera is not delivered"
    assert c.get(f"/api/v1/exports/{done_job}/download", headers=h).status_code == 403, "nor a finished one"
    assert json.loads(stop["details_json"])["reason"] == "access_lost" and cancel["reason"] == "access_lost"
    assert c.get(f"/api/v1/me?known={known}", headers=h).json()["permissions_changed"] is True


def test_deactivated_user_loses_everything_at_once(tmp_path):
    from smplwise.services import revocation

    settings = _settings(tmp_path)
    w = _world(settings)
    c, cams = w["c"], w["cams"]
    c.get("/api/v1/me", headers=as_user("dov"))
    _binding(settings, "dov", "operator", "camera", cams["cam2"])
    h = as_user("dov")
    assert c.get(f"/api/v1/media/live/{cams['cam2']}", headers=h).status_code == 200
    gen = revocation.generation("dev-dov")
    with Database(settings.db_path).connection() as conn:  # what the bridge's directory push does for a user disabled in HA
        conn.execute("UPDATE users SET active = 0 WHERE id = 'dev-dov'")
    revocation.mark(["dev-dov"])
    assert revocation.generation("dev-dov") > gen
    r = c.get(f"/api/v1/media/live/{cams['cam2']}", headers=h)
    assert r.status_code == 403 and r.json()["details"]["reason"] == "user_inactive"
    me = c.get("/api/v1/me", headers=h).json()
    assert me["active"] is False and c.get("/api/v1/cameras", headers=h).json()["cameras"] == []


# ---------------------------------------------------------------- 5. audit scope

def test_audit_rows_carry_the_authorising_scope(tmp_path, monkeypatch):
    from smplwise.routers import playback as pbr

    settings = _settings(tmp_path, go2rtc_url="http://go2rtc:1984")
    w = _world(settings)
    c, cams = w["c"], w["cams"]
    c.get("/api/v1/me", headers=as_user("ava"))
    bid = _binding(settings, "ava", "operator", "camera", cams["cam2"])
    h = as_user("ava")
    with Database(settings.db_path).connection() as conn:
        conn.execute("UPDATE cameras SET main_track = 101 WHERE id = ?", (cams["cam2"],))
    monkeypatch.setattr(pbr, "_segment_for", lambda _s, _c, _cam, start, _tz: (start, start + dt.timedelta(hours=1)))
    monkeypatch.setattr(pb, "_create_stream", lambda _s, session, _start: setattr(session, "stream", f"smplwise_pb_{session.id}"))
    monkeypatch.setattr(pb, "_delete_stream", lambda _s, name: None)
    try:
        r = c.post("/api/v1/playback/sessions", json={"camera_id": cams["cam2"], "start_at": "2026-09-20T10:00:00Z"}, headers=h)
        assert r.status_code == 201, r.text
        assert c.get(f"/api/v1/media/live/{cams['cam3']}", headers=h).status_code == 403
        # a configuration change by the administrator records the binding it was authorised under
        assert c.patch(f"/api/v1/cameras/{cams['cam2']}", json={"alias": "לובי ראשי"}).status_code == 200
    finally:
        pb.REGISTRY.sessions.clear()
    rows = {r["action"]: r for r in c.get("/api/v1/audit?prefix=&limit=200").json()["rows"]}
    start = rows["video.playback.start"]
    assert (start["scope_type"], start["scope_id"], start["role_id"], start["binding_id"]) == ("camera", cams["cam2"], "operator", bid)
    denied = rows["video.live"]
    assert denied["decision"] == "denied" and denied["resource_id"] == cams["cam3"] and denied["reason"] == "no_binding"
    upd = rows["camera.update"]
    assert (upd["scope_type"], upd["scope_id"], upd["role_id"]) == ("installation", "*", "system_admin")
    assert "rtsp" not in json.dumps(list(rows.values())) and "password" not in json.dumps(list(rows.values()))
    # audit reading stays restricted: a camera-scoped operator (or site-scoped anyone) reads none of it
    assert c.get("/api/v1/audit", headers=h).status_code == 403
