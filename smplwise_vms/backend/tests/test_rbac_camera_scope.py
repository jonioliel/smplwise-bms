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
        nvr_host=None, nvr_http_port=80, nvr_user=None, nvr_password=None, go2rtc_url=None, log_level="warning", max_upload_bytes=5 * 1024 * 1024,
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


def _event(app, eid: str, camera_id: str) -> None:
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
    case = c.post("/api/v1/cases", json={"title": "היקף מצלמה"}).json()["id"]
    for eid in ("e2", "e3"):
        assert c.post(f"/api/v1/cases/{case}/items", json={"kind": "event", "event_id": eid}).status_code == 201
    return {"app": app, "c": c, "settings": settings, **ids, "site_b": site_b, "building_b": bld_b, "floor_b": floor_b, "cams": cams, "versions": versions, "case": case}


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

def _status(r) -> int:
    return r.status_code


def _ws_close_code(c: TestClient, url: str, h: dict[str, str]) -> int:
    with pytest.raises(WebSocketDisconnect) as ei:
        with c.websocket_connect(url, headers=dict(h)) as ws:  # the client adds upgrade headers to the dict it is given
            ws.receive_text()
    return ei.value.code


def _today() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")


# (name, check(c, h, w, cams)) - each asserts the scoped camera is served and every other camera refused or filtered
RESOURCES: list[tuple[str, Callable[..., None]]] = []


def resource(name: str):
    def deco(fn):
        RESOURCES.append((name, fn))
        return fn
    return deco


@resource("camera list")
def _(c, h, w, cams):
    assert {x["id"] for x in c.get("/api/v1/cameras", headers=h).json()["cameras"]} == {cams["cam2"]}


@resource("snapshot")
def _(c, h, w, cams):
    assert c.get(f"/api/v1/cameras/{cams['cam3']}/snapshot.jpg", headers=h).status_code == 403
    assert c.get(f"/api/v1/cameras/{cams['cam2']}/snapshot.jpg", headers=h).status_code != 403  # the NVR is not configured here


@resource("live info")
def _(c, h, w, cams):
    assert [c.get(f"/api/v1/media/live/{cams[k]}", headers=h).status_code for k in ("cam2", "cam3", "cam_split", "cam_free")] == [200, 403, 403, 403]


@resource("live socket")
def _(c, h, w, cams):
    assert _ws_close_code(c, f"/api/v1/media/live/{cams['cam3']}/ws?profile=sub", h) == 4403
    assert _ws_close_code(c, f"/api/v1/media/live/{cams['cam2']}/ws?profile=sub", h) == 4503  # authorised; go2rtc is not configured


@resource("recordings")
def _(c, h, w, cams):
    assert c.get(f"/api/v1/cameras/{cams['cam3']}/recordings?date={_today()}", headers=h).status_code == 403
    assert c.get(f"/api/v1/cameras/{cams['cam2']}/recordings?date={_today()}", headers=h).status_code != 403


@resource("recording frame")
def _(c, h, w, cams):
    assert c.get(f"/api/v1/cameras/{cams['cam3']}/frame?at=2026-09-20T10:00:00Z", headers=h).status_code == 403
    assert c.get(f"/api/v1/cameras/{cams['cam2']}/frame?at=2026-09-20T10:00:00Z", headers=h).status_code != 403


@resource("playback session")
def _(c, h, w, cams):
    body = {"start_at": "2026-09-20T10:00:00Z"}
    assert c.post("/api/v1/playback/sessions", json={**body, "camera_id": cams["cam3"]}, headers=h).status_code == 403
    assert c.post("/api/v1/playback/sessions", json={**body, "camera_id": cams["cam2"]}, headers=h).json()["code"] == "no_track"


@resource("playback group")
def _(c, h, w, cams):
    assert c.post("/api/v1/playback/groups", json={"camera_ids": [cams["cam2"], cams["cam3"]], "start_at": "2026-09-20T10:00:00Z"}, headers=h).status_code == 403


@resource("events list")
def _(c, h, w, cams):
    assert {e["id"] for e in c.get("/api/v1/events", headers=h).json()["events"]} == {"e2"}


@resource("event facets")
def _(c, h, w, cams):
    f = c.get("/api/v1/events/facets", headers=h).json()
    assert sum(t["count"] for t in f["types"]) == 1
    floors = {fl["id"]: fl for s in f["places"] for b in s["buildings"] for fl in b["floors"]}
    assert floors[w["floor2"]]["cameras"] == 1 and floors[w["floor3"]]["cameras"] == 0 and floors[w["floor_b"]]["cameras"] == 0


@resource("event summary")
def _(c, h, w, cams):
    assert c.get("/api/v1/events/summary", headers=h).json()["today"]["total"] <= 1  # e2 only (when "today" in the zone)


@resource("review windows")
def _(c, h, w, cams):
    assert c.get("/api/v1/events/windows", headers=h).json()["events_total"] == 1


@resource("camera timeline")
def _(c, h, w, cams):
    assert c.get(f"/api/v1/cameras/{cams['cam3']}/events?date={_today()}", headers=h).status_code == 403
    assert c.get(f"/api/v1/cameras/{cams['cam2']}/events?date={_today()}", headers=h).status_code == 200


@resource("event detail, thumbnail, correlation, route")
def _(c, h, w, cams):
    for tail in ("", "/thumbnail", "/correlation", "/route"):
        assert c.get(f"/api/v1/events/e3{tail}", headers=h).status_code == 403, tail
    assert c.get("/api/v1/events/e2", headers=h).status_code == 200


@resource("case items")
def _(c, h, w, cams):
    case = c.get(f"/api/v1/cases/{w['case']}?check=false", headers=h).json()
    assert [i["camera_id"] for i in case["items"]] == [cams["cam2"]] and case["hidden_items"] == 1


@resource("case bundle download")
def _(c, h, w, cams):
    built = w["c"].post(f"/api/v1/cases/{w['case']}/bundle")
    assert built.status_code == 201, built.text
    assert c.get(f"/api/v1/cases/{w['case']}/bundles/{built.json()['name']}", headers=h).status_code == 403, "the ZIP holds cam3's item too"


@resource("export create and download")
def _(c, h, w, cams):
    body = {"from_at": "2026-09-20T10:00:00Z", "to_at": "2026-09-20T10:05:00Z"}
    assert c.post("/api/v1/exports/estimate", json={**body, "camera_id": cams["cam3"]}, headers=h).status_code == 403
    assert c.post("/api/v1/exports/estimate", json={**body, "camera_id": cams["cam2"]}, headers=h).json()["code"] == "no_track"
    job = _job(w, "scoped", cams["cam3"], "done")
    assert c.get(f"/api/v1/exports/{job}/download", headers=h).status_code == 403


@resource("PTZ / capabilities and detection zones")
def _(c, h, w, cams):
    for tail in ("capabilities", "zones"):
        assert c.get(f"/api/v1/cameras/{cams['cam3']}/{tail}", headers=h).status_code == 403
        assert c.get(f"/api/v1/cameras/{cams['cam2']}/{tail}", headers=h).status_code != 403


@resource("camera settings (manual record state)")
def _(c, h, w, cams):
    assert c.get(f"/api/v1/cameras/{cams['cam3']}/record", headers=h).status_code == 403
    assert c.get(f"/api/v1/cameras/{cams['cam2']}/record", headers=h).status_code == 200


@resource("floor map bundle")
def _(c, h, w, cams):
    m = c.get(f"/api/v1/floors/{w['floor2']}/map", headers=h).json()
    assert m["reach"] == "cameras" and [a["resource_id"] for a in m["anchors"]] == [cams["cam2"]], "no cam_split, no light"
    assert [x["id"] for x in m["cameras"]] == [cams["cam2"]] and m["zones"] == [] and m["circuit_states"] == {}
    assert not any(m["permissions"].values())
    assert c.get(f"/api/v1/floors/{w['floor3']}/map", headers=h).status_code == 403
    assert c.get(f"/api/v1/floors/{w['floor_b']}/map", headers=h).status_code == 403
    assert c.get(f"/api/v1/floors/{w['floor2']}/anchors", headers=h).status_code == 403, "the raw anchor list stays floor-scoped"


@resource("sites tree and plan image")
def _(c, h, w, cams):
    tree = c.get("/api/v1/sites", headers=h).json()["sites"]
    assert [f["id"] for s in tree for b in s["buildings"] for f in b["floors"]] == [w["floor2"]]
    assert c.get(f"/api/v1/plan-versions/{w['versions'][w['floor2']]}/image.png", headers=h).status_code == 200
    assert c.get(f"/api/v1/plan-versions/{w['versions'][w['floor3']]}/image.png", headers=h).status_code == 403


@resource("search")
def _(c, h, w, cams):
    found = {r["id"] for r in c.get("/api/v1/search?q=cam&limit=20", headers=h).json()["results"] if r["kind"] == "camera"}
    assert found == {cams["cam2"]}


@resource("saved views")
def _(c, h, w, cams):
    views = [v for v in c.get("/api/v1/views", headers=h).json()["views"] if v["name"] == "כל המצלמות"]
    assert views and views[0]["cameras"] == [cams["cam2"]] and views[0]["hidden_cameras"] == 4


@resource("health per camera")
def _(c, h, w, cams):
    body = c.get("/api/v1/health/summary", headers=h).text
    assert cams["cam3"] not in body and c.get("/api/v1/health/report", headers=h).status_code == 403


@resource("WisKey station cameras")
def _(c, h, w, cams):
    # stations are not VMS cameras: access.read at camera scope reaches no station and no still
    assert c.get("/api/v1/intercom/overview", headers=h).status_code == 403


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
def scoped(world) -> dict[str, str]:
    """`scoped`: operator bound to cam2 alone (a camera binding) - live, playback, events, export on that camera."""
    c = world["c"]
    c.get("/api/v1/me", headers=as_user("scoped"))
    _binding(world["settings"], "scoped", "operator", "camera", world["cams"]["cam2"])
    assert c.post("/api/v1/views", json={"name": "כל המצלמות", "cameras": list(world["cams"].values()), "shared": True}).status_code == 201
    return as_user("scoped")


@pytest.mark.parametrize("name,check", RESOURCES, ids=[n for n, _ in RESOURCES])
def test_every_camera_resource_is_filtered(world, scoped, name, check):
    check(world["c"], scoped, world, world["cams"])


def test_camera_scoped_me_and_navigation(world, scoped):
    me = world["c"].get("/api/v1/me", headers=scoped).json()
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
    async def fake_relay(websocket, url, headers, on_down, should_stop=None):
        await websocket.send_text('{"type":"ready"}')
        for _ in range(400):
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
