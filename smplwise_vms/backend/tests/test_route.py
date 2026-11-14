"""Suggested path (T064): cameras ranked same room → adjacent room → within reach on the floor plan, with the time
window and the activity each reported; far cameras are not suggested; unplaced cameras get no topology; every
answer is labelled hypothetical and carries the no-action policy; scope filtering applies."""
from __future__ import annotations

import datetime as dt
import json

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import correlation

SQ = lambda x0, y0, x1, y1: [{"x": x0, "y": y0}, {"x": x1, "y": y0}, {"x": x1, "y": y1}, {"x": x0, "y": y1}]  # noqa: E731


def _event(app, eid: str, camera_id: str | None, occurred: str) -> None:
    with app.state.db.connection() as conn:
        conn.execute(
            "INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (eid, "alertstream", "VMD", "motion", camera_id, 1, occurred, None, occurred, "inactive", 1, "info", "measured", json.dumps({}), f"t:{eid}", occurred),
        )


def test_polygons_touch():
    a, b, c = SQ(0.1, 0.1, 0.5, 0.5), SQ(0.5, 0.1, 0.8, 0.5), SQ(0.7, 0.7, 0.9, 0.9)
    assert correlation.polygons_touch(a, b) and correlation.polygons_touch(b, a)
    assert not correlation.polygons_touch(a, c)
    assert correlation.polygons_touch(a, SQ(0.505, 0.2, 0.7, 0.4)), "a 5 mm gap on a normalized plan still counts as a shared wall"


def test_route_ranking_window_activity_and_scope(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    floor = ids["floor2"]
    asset = c.post(f"/api/v1/floors/{floor}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{floor}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    cams = {}
    for i, alias in enumerate(("לובי", "לובי 2", "מסדרון", "מחסן", "ליד", "לא מוצבת"), start=1):
        cams[alias] = c.post("/api/v1/cameras", json={"channel": i, "alias": alias}).json()["id"]
    place = lambda cid, x, y: c.post(f"/api/v1/floors/{floor}/anchors", json={"resource_type": "camera", "resource_id": cid, "x": x, "y": y}).status_code  # noqa: E731
    assert place(cams["לובי"], 0.2, 0.3) == 201
    assert place(cams["לובי 2"], 0.4, 0.4) == 201
    assert place(cams["מסדרון"], 0.65, 0.3) == 201
    assert place(cams["מחסן"], 0.85, 0.85) == 201
    assert place(cams["ליד"], 0.05, 0.35) == 201  # outside every room (x < 0.1), 0.16 from the lobby camera → nearby
    for name, poly in (("לובי", SQ(0.1, 0.1, 0.5, 0.5)), ("מסדרון", SQ(0.5, 0.1, 0.8, 0.5)), ("מחסן", SQ(0.75, 0.75, 0.95, 0.95))):
        assert c.post(f"/api/v1/floors/{floor}/zones", json={"name": name, "kind": "room", "polygon": poly}).status_code == 201
    t0 = "2026-09-16T10:00:00Z"
    _event(app, "e0", cams["לובי"], t0)
    _event(app, "corr1", cams["מסדרון"], "2026-09-16T10:00:30Z")
    _event(app, "corr2", cams["מסדרון"], "2026-09-16T10:01:10Z")
    _event(app, "late", cams["מסדרון"], "2026-09-16T10:05:00Z")
    _event(app, "sys", None, t0)
    _event(app, "un", cams["לא מוצבת"], t0)

    r = c.get("/api/v1/events/e0/route")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["hypothetical"] is True and d["spatial"] is True and d["subject"] == {"camera_id": cams["לובי"], "name": "לובי", "zone": "לובי"}
    assert d["window"] == {"from": "2026-09-16T09:59:45Z", "to": "2026-09-16T10:01:30Z"}
    got = [(s["name"], s["relation"], s["activity_events"]) for s in d["suggestions"]]
    assert got == [("לובי 2", "same_zone", 0), ("מסדרון", "adjacent_zone", 2), ("ליד", "nearby", 0)], got
    assert all(s["playback_at"] == t0 for s in d["suggestions"]) and d["suggestions"][1]["zone"] == "מסדרון"
    assert "מחסן" not in [s["name"] for s in d["suggestions"]], "far room, no shared wall, out of reach"
    assert "אינה מופעלת" in d["policy"] and any("מדרגות" in n for n in d["notes"])
    assert c.get("/api/v1/events/e0/route?window=600").json()["suggestions"][1]["activity_events"] == 3
    # no camera / unplaced camera: honest notes, no suggestions
    s_ = c.get("/api/v1/events/sys/route").json()
    assert s_["spatial"] is False and s_["suggestions"] == [] and s_["subject"] is None
    u = c.get("/api/v1/events/un/route").json()
    assert u["spatial"] is False and u["suggestions"] == [] and any("אינה מוצבת" in n for n in u["notes"])
    assert c.get("/api/v1/events/nope/route").status_code == 404
    # scope: an operator of this floor sees the floor's cameras; a viewer has no events.read at all
    bind(c, settings, "omer", "operator", "floor", floor)
    assert [s["name"] for s in c.get("/api/v1/events/e0/route", headers=as_user("omer")).json()["suggestions"]] == ["לובי 2", "מסדרון", "ליד"]
    bind(c, settings, "vera", "viewer", "floor", floor)
    assert c.get("/api/v1/events/e0/route", headers=as_user("vera")).status_code == 403


# ---------------------------------------------------------------- M064: floor connectors in the ranking, one-click confirm into a case

def _plan(c, floor_id: str) -> str:
    asset = c.post(f"/api/v1/floors/{floor_id}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{floor_id}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    return v["id"]


def _save_geometry(c, vid: str, **fields) -> None:
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], **fields), "base_revision": g["geometry"]["revision"]})
    assert r.status_code == 200, r.text


def test_route_through_stairs_to_another_floor_and_confirm_into_case(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    f2, f3 = ids["floor2"], ids["floor3"]
    v2, v3 = _plan(c, f2), _plan(c, f3)
    cams = {}
    for i, alias in enumerate(("לובי", "מסדרון", "קומה 3 ליד המדרגות", "קומה 3 רחוק"), start=1):
        cams[alias] = c.post("/api/v1/cameras", json={"channel": i, "alias": alias}).json()["id"]
    place = lambda fid, cid, x, y: c.post(f"/api/v1/floors/{fid}/anchors", json={"resource_type": "camera", "resource_id": cid, "x": x, "y": y}).status_code  # noqa: E731
    assert place(f2, cams["לובי"], 0.2, 0.3) == 201
    assert place(f2, cams["מסדרון"], 0.65, 0.3) == 201
    assert place(f3, cams["קומה 3 ליד המדרגות"], 0.42, 0.5) == 201
    assert place(f3, cams["קומה 3 רחוק"], 0.9, 0.9) == 201
    assert c.post(f"/api/v1/floors/{f2}/zones", json={"name": "לובי", "kind": "room", "polygon": SQ(0.1, 0.1, 0.5, 0.5)}).status_code == 201
    assert c.post(f"/api/v1/floors/{f2}/zones", json={"name": "מסדרון", "kind": "room", "polygon": SQ(0.5, 0.1, 0.8, 0.5)}).status_code == 201
    assert c.post(f"/api/v1/floors/{f3}/zones", json={"name": "חדר מדרגות 3", "kind": "room", "polygon": SQ(0.3, 0.4, 0.5, 0.6)}).status_code == 201
    t0 = "2026-09-16T10:00:00Z"
    _event(app, "e0", cams["לובי"], t0)
    _event(app, "up1", cams["קומה 3 ליד המדרגות"], "2026-09-16T10:00:40Z")
    # before any stairs are published: the same-floor answer, and the note says there are no floor connectors
    r0 = c.get("/api/v1/events/e0/route").json()
    assert [s["relation"] for s in r0["suggestions"]] == ["adjacent_zone"] and r0["connectors"] == [] and any("מדרגות" in n for n in r0["notes"])
    # stairs drawn in the lobby (0.35, 0.45 - inside the lobby room), linked to floor 3, published on both floors
    stairs = {"id": "st1", "kind": "stairs", "level_from": "L0", "level_to": None, "floor_ids": [], "polyline": [[0.3, 0.45], [0.4, 0.45]], "width_m": 1.2, "label": "מדרגות ראשיות",
              "object_id": None, "source": "manual", "external_ids": {}}
    _save_geometry(c, v2, connectors=[stairs])
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/link", json={"connector_id": "st1", "floor_id": f3}).status_code == 200
    assert c.post(f"/api/v1/plan-versions/{v2}/geometry/publish").status_code == 200
    r1 = c.get("/api/v1/events/e0/route").json()
    got = [(s["name"], s["relation"], s["floor_id"], s["activity_events"]) for s in r1["suggestions"]]
    assert got == [("מסדרון", "adjacent_zone", f2, 0), ("קומה 3 ליד המדרגות", "via_connector", f3, 1)], got
    up = r1["suggestions"][1]
    assert up["via"]["connector_id"] == "st1" and up["via"]["kind_label"] == "מדרגות" and up["via"]["floor_name"] == "קומה 3" and up["via"]["direction"] == "up"
    assert up["relation_label"] == "מדרגות ↑ קומה 3" and up["zone"] == "חדר מדרגות 3" and up["floor_name"] == "קומה 3"
    assert up["via"]["twin_published"] is False and any("תאום" in n for n in r1["notes"]), "floor 3 has not published its twin yet: the position is assumed"
    assert r1["connectors"] == [{"id": "st1", "kind": "stairs", "kind_label": "מדרגות", "other_floor_id": f3, "distance": 0.212, "twin_published": False}]
    assert "קומה 3 רחוק" not in [s["name"] for s in r1["suggestions"]], "far from the stairs on the other floor"
    assert "מעבר קומה" in r1["policy"]
    # the twin published on floor 3 too: the same answer, now from the twin's own position
    assert c.post(f"/api/v1/plan-versions/{v3}/geometry/publish").status_code == 200
    r2 = c.get("/api/v1/events/e0/route").json()
    assert r2["suggestions"][1]["via"]["twin_published"] is True and not any("תאום" in n for n in r2["notes"])
    # scope: an operator of floor 2 only does not get floor 3's camera; the suggestion through the stairs is filtered by camera scope
    bind(c, settings, "omer", "operator", "floor", f2)
    assert [s["name"] for s in c.get("/api/v1/events/e0/route", headers=as_user("omer")).json()["suggestions"]] == ["מסדרון"]
    # one click into a case: the event + a clip per chosen suggested camera over the route window; a camera outside
    # the suggestion is reported, not added; the notes say "hypothesis"
    r = c.post("/api/v1/events/e0/route/confirm", json={"camera_ids": [cams["קומה 3 ליד המדרגות"], cams["מסדרון"], cams["קומה 3 רחוק"]]})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["created"] is True and body["hypothetical"] is True and body["title"] == "מסלול מוצע · לובי · 16.09 13:00", "the default title in the installation's zone (Asia/Jerusalem)"
    assert [a["kind"] for a in body["added"]] == ["event", "clip", "clip"] and body["added"][1]["via"]["connector_id"] == "st1" and body["added"][2]["relation"] == "adjacent_zone"
    assert body["skipped"] == [{"camera_id": cams["קומה 3 רחוק"], "reason": "לא בהצעת המסלול של האירוע"}]
    assert body["window"] == {"from": "2026-09-16T09:59:45Z", "to": "2026-09-16T10:01:30Z"}
    case = c.get(f"/api/v1/cases/{body['case_id']}?check=false").json()
    assert case["counts"]["events"] == 1 and case["counts"]["clips"] == 2 and case["tags"] == ["מסלול מוצע"]
    clips = [i for i in case["items"] if i["kind"] == "clip"]
    assert all("השערת מסלול" in i["note"] and "לא זיהוי" in i["note"] for i in clips) and all(i["from_at"] == "2026-09-16T09:59:45Z" for i in clips)
    # into the same case again: the event is not duplicated, the clips are added once more (another confirmation)
    again = c.post("/api/v1/events/e0/route/confirm", json={"camera_ids": [cams["מסדרון"]], "case_id": body["case_id"], "note": "בדיקה שנייה"}).json()
    assert again["created"] is False and [a["kind"] for a in again["added"]] == ["clip"]
    assert c.get(f"/api/v1/cases/{body['case_id']}?check=false").json()["counts"] ["clips"] == 3
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'case.route.confirm'").fetchone()[0] == 2
    # refusals: nothing offered, a closed case, a viewer
    assert c.post("/api/v1/events/e0/route/confirm", json={"camera_ids": [cams["קומה 3 רחוק"]]}).status_code == 422
    assert c.patch(f"/api/v1/cases/{body['case_id']}", json={"revision": case["revision"], "status": "closed"}).status_code == 200
    assert c.post("/api/v1/events/e0/route/confirm", json={"camera_ids": [cams["מסדרון"]], "case_id": body["case_id"]}).status_code == 409
    bind(c, settings, "vera", "viewer", "installation", "*")
    assert c.post("/api/v1/events/e0/route/confirm", json={"camera_ids": [cams["מסדרון"]]}, headers=as_user("vera")).status_code == 403
    assert c.post("/api/v1/events/nope/route/confirm", json={"camera_ids": [cams["מסדרון"]]}).status_code == 404
