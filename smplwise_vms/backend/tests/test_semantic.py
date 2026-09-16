"""T063: the local baseline turns free text into the event centre's own filters (object class from the device's
detection target, places by catalogue name, a time window in the site zone), reports colour / appearance terms as
unsupported with the reason, runs scoped, labels every hit with a confidence and its basis, and never claims
identity; the provider registry exposes the opt-in / privacy / budget contract and no external provider is
bundled."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from zoneinfo import ZoneInfo

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import semantic


def _setup(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    f2 = ids["floor2"]
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי ראשי"}).json()["id"]
    cam2 = c.post("/api/v1/cameras", json={"channel": 2, "alias": "Gate"}).json()["id"]
    asset = c.post(f"/api/v1/floors/{f2}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{f2}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    c.post(f"/api/v1/floors/{f2}/anchors", json={"resource_type": "camera", "resource_id": cam, "x": 0.3, "y": 0.3})
    c.post(f"/api/v1/floors/{f2}/anchors", json={"resource_type": "camera", "resource_id": cam2, "x": 0.8, "y": 0.8})
    z = c.post(f"/api/v1/floors/{f2}/zones", json={"name": "לובי", "kind": "room", "polygon": [{"x": 0.1, "y": 0.1}, {"x": 0.5, "y": 0.1}, {"x": 0.5, "y": 0.5}, {"x": 0.1, "y": 0.5}], "searchable": True})
    assert z.status_code == 201, z.text
    return app, c, ids, cam, cam2


def _event(conn: sqlite3.Connection, cam: str, typ: str, when: dt.datetime, confidence: str = "measured", target: str | None = None) -> str:
    eid = f"ev{abs(hash((cam, typ, when.isoformat()))) % 10**10}"
    iso = when.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    conn.execute(
        "INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (eid, "alertstream", "VMD", typ, cam, 1, iso, iso, "none", 1, "info", confidence, json.dumps({"target": target}), eid, iso),
    )
    return eid


def test_parse_hebrew_and_english(settings):
    app, c, ids, cam, cam2 = _setup(settings)
    tz = ZoneInfo("Asia/Jerusalem")
    now = dt.datetime(2026, 9, 17, 12, 0, tzinfo=tz)
    with app.state.db.connection() as conn:
        p = semantic.parse("אדם בלובי אתמול בערב", conn, "Asia/Jerusalem", now=now)
        assert p.objects == ["person"] and p.types == ["person"]
        assert [(x["kind"], x["name"], x["match"]) for x in p.places][:1] == [("zone", "לובי", "exact")]
        assert p.window and p.window["label"].startswith("אתמול") and p.window["from"] == "2026-09-16T14:00:00Z" and p.window["to"] == "2026-09-16T20:00:00Z"
        assert "אדם" in p.terms_used and "אתמול" in p.terms_used and "בערב" in p.terms_used and not p.unsupported
        p2 = semantic.parse("vehicle near the gate this morning 08:00-09:30", conn, "Asia/Jerusalem", now=now)
        assert p2.objects == ["vehicle"] and any(x["kind"] == "camera" and x["name"] == "Gate" and x["match"] == "exact" for x in p2.places)
        assert p2.window and p2.window["from"] == "2026-09-17T05:00:00Z" and p2.window["to"] == "2026-09-17T06:30:00Z"
        p3 = semantic.parse("אדם עם תיק אדום היום", conn, "Asia/Jerusalem", now=now)
        assert {u["term"] for u in p3.unsupported} == {"אדום", "תיק"} and all("provider" in u["reason"] for u in p3.unsupported)
        assert p3.window and p3.window["label"] == "היום" and p3.window["from"] == "2026-09-16T21:00:00Z"
        p4 = semantic.parse("משהו לא קשור", conn, "Asia/Jerusalem", now=now)
        assert not p4.objects and not p4.places and p4.window is None and set(p4.leftovers) == {"משהו", "לא", "קשור"}


def test_semantic_endpoint_scoped_with_confidence(settings):
    app, c, ids, cam, cam2 = _setup(settings)
    tz = ZoneInfo("Asia/Jerusalem")
    now = dt.datetime.now(tz)
    with app.state.db.connection() as conn:
        person = _event(conn, cam, "person", now - dt.timedelta(hours=1), "measured", "human")
        vehicle = _event(conn, cam2, "vehicle", now - dt.timedelta(hours=1), "measured", "vehicle")
        inferred = _event(conn, cam, "person", now - dt.timedelta(hours=2), "inferred")
    r = c.get("/api/v1/search/semantic", params={"q": "אדם בקומה 2 היום"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["provider"]["id"] == "local" and d["provider"]["network"] is False and "ראיית זהות" in d["note"]
    assert d["parsed"]["types"] == ["person"] and any(p["kind"] == "floor" and p["match"] == "exact" for p in d["parsed"]["places"])
    got = {e["id"]: e for e in d["results"]}
    assert person in got and inferred in got and vehicle not in got
    assert got[person]["match"]["confidence"] == "exact" and any("מהמכשיר" in b for b in got[person]["match"]["basis"])
    assert got[inferred]["match"]["confidence"] == "partial"
    # unsupported terms travel with the answer; a plain query without a place or object still answers within scope
    d2 = c.get("/api/v1/search/semantic", params={"q": "רכב כחול היום"}).json()
    assert d2["unsupported"] and d2["unsupported"][0]["term"] == "כחול" and [e["id"] for e in d2["results"]] == [vehicle]
    # scope: a viewer on floor 3 sees neither the floor-2 place nor its events
    bind(c, settings, "ron", "viewer", "floor", ids["floor3"])
    d3 = c.get("/api/v1/search/semantic", params={"q": "אדם בקומה 2 היום"}, headers=as_user("ron"))
    assert d3.status_code in (200, 403)
    if d3.status_code == 200:
        assert not d3.json()["parsed"]["places"] and not d3.json()["results"]
    # registry and settings: the external provider exists only as a contract and cannot be switched on
    reg = c.get("/api/v1/search/providers").json()
    assert reg["active"] == "local" and [p["id"] for p in reg["providers"]] == ["local", "external"] and reg["providers"][1]["available"] is False
    assert reg["providers"][1]["opt_in_required"] is True and "privacy" in reg["providers"][1] and reg["settings"]["ai.privacy_ack"] == "false"
    assert c.patch("/api/v1/settings", json={"ai.provider": "external"}).status_code == 422
    assert c.patch("/api/v1/settings", json={"ai.provider": "none"}).status_code == 200
    assert c.get("/api/v1/search/semantic", params={"q": "אדם"}).status_code == 409
    assert c.patch("/api/v1/settings", json={"ai.provider": "local", "ai.budget_daily": 5}).status_code == 200
    assert c.get("/api/v1/search/providers").json()["settings"]["ai.budget_daily"] == 5
