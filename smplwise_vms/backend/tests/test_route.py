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
