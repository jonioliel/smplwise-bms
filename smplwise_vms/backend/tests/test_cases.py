"""Investigation cases (T049): CRUD with revisions and permissions; items linking events, clips and notes across
cameras; preservation reported honestly (NVR-only bookmark, preserved copy via an export job, missing footage,
unknown when it cannot be checked)."""
from __future__ import annotations

import json
from dataclasses import replace

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.routers import cases
from smplwise.services.recordings import SearchResult, Segment


def _insert_event(app, eid: str, camera_id: str | None, occurred: str) -> None:
    with app.state.db.connection() as conn:
        conn.execute(
            "INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (eid, "alertstream", "VMD", "motion", camera_id, 1, occurred, None, occurred, "inactive", 1, "info", "measured", json.dumps({}), f"t:{eid}", occurred),
        )


def test_cases_crud_items_and_preservation(settings, monkeypatch):
    app = create_app(replace(settings, nvr_host="nvr.example", nvr_user="u", nvr_password="p"))
    c = TestClient(app)
    seed_tree(c)
    cam1 = c.post("/api/v1/cameras", json={"channel": 1, "alias": "כניסה"}).json()
    cam2 = c.post("/api/v1/cameras", json={"channel": 2, "alias": "חניה"}).json()
    with app.state.db.connection() as conn:
        conn.execute("UPDATE cameras SET main_track = channel * 100 + 1")
    _insert_event(app, "e1", cam1["id"], "2026-09-14T10:00:10Z")

    # create, list, edit with revisions
    r = c.post("/api/v1/cases", json={"title": "  כניסה לא מורשית ", "tags": ["כניסה", "כניסה", " לילה "]})
    assert r.status_code == 201, r.text
    case = r.json()
    assert case["title"] == "כניסה לא מורשית" and case["status"] == "open" and case["revision"] == 1 and case["tags"] == ["כניסה", "לילה"]
    assert case["counts"] == {"items": 0, "events": 0, "clips": 0, "notes": 0, "preserved": 0} and case["owner_username"]
    lst = c.get("/api/v1/cases").json()
    assert lst["cases"][0]["id"] == case["id"] and lst["can_manage"] is True
    stale = c.patch(f"/api/v1/cases/{case['id']}", json={"revision": 5, "title": "x"})
    assert stale.status_code == 409 and stale.json()["code"] == "stale_revision" and stale.json()["details"]["current_revision"] == 1
    upd = c.patch(f"/api/v1/cases/{case['id']}", json={"revision": 1, "status": "in_review", "description": "בדיקה"}).json()
    assert upd["revision"] == 2 and upd["status"] == "in_review" and upd["description"] == "בדיקה" and upd["closed_at"] is None
    assert c.get("/api/v1/cases?status=open").json()["cases"] == []
    assert len(c.get("/api/v1/cases?q=לילה").json()["cases"]) == 1 and c.get("/api/v1/cases?q=zzz").json()["cases"] == []

    # items: an event (window around it), a clip on another camera, a note
    ev_item = c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "event", "event_id": "e1"}).json()
    assert ev_item["kind"] == "event" and ev_item["camera_id"] == cam1["id"] and ev_item["camera_name"] == "כניסה"
    assert ev_item["from_at"] == "2026-09-14T10:00:05Z" and ev_item["to_at"] == "2026-09-14T10:00:40Z" and ev_item["event"]["type"] == "motion"
    assert c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "event", "event_id": "e1"}).json()["code"] == "already_in_case"
    assert c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "event", "event_id": "nope"}).status_code == 404
    clip = c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "clip", "camera_id": cam2["id"], "from_at": "2026-09-14T11:00:00Z", "to_at": "2026-09-14T11:01:00Z", "note": "רכב"}).json()
    assert clip["kind"] == "clip" and clip["camera_name"] == "חניה" and clip["note"] == "רכב" and clip["preservation"] == "unknown", "no NVR probe on insert"
    assert c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "clip", "camera_id": cam2["id"], "from_at": "2026-09-14T11:01:00Z", "to_at": "2026-09-14T11:00:00Z"}).status_code == 422
    assert c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "clip", "camera_id": "nope", "from_at": "2026-09-14T11:00:00Z", "to_at": "2026-09-14T11:01:00Z"}).status_code == 404
    note = c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "note", "note": "לבדוק את המסדרון"}).json()
    assert note["kind"] == "note" and note["preservation"] == "none"
    assert c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "note", "note": "  "}).status_code == 422

    # preservation: the NVR still has the event window, the clip window is gone
    def fake_search(s, conn, cam, start, end, tz):
        segs = [Segment("2026-09-14T09:00:00Z", "2026-09-14T10:30:00Z", "continuous", 101, "", "")] if cam["id"] == cam1["id"] else []
        return SearchResult(segs, "complete", len(segs), 1, "2026-09-14T12:00:00Z", tz)

    monkeypatch.setattr(cases, "SEARCH", fake_search)
    d = c.get(f"/api/v1/cases/{case['id']}").json()
    by = {i["id"]: i for i in d["items"]}
    assert d["checked"] is True and d["hidden_items"] == 0
    assert by[ev_item["id"]]["preservation"] == "nvr_only" and by[clip["id"]]["preservation"] == "missing" and by[note["id"]]["preservation"] == "none"
    assert d["counts"] == {"items": 3, "events": 1, "clips": 1, "notes": 1, "preserved": 0}
    assert {i["preservation"] for i in c.get(f"/api/v1/cases/{case['id']}?check=false").json()["items"]} == {"unknown", "none"}

    def failing_search(s, conn, cam, start, end, tz):
        raise RuntimeError("nvr down")

    monkeypatch.setattr(cases, "SEARCH", failing_search)
    assert c.get(f"/api/v1/cases/{case['id']}").json()["items"][0]["preservation"] == "unknown", "an unreachable NVR is never 'preserved' or 'missing'"
    monkeypatch.setattr(cases, "SEARCH", fake_search)

    # preserved only after an export job copied the footage
    with app.state.db.connection() as conn:
        conn.execute(
            "INSERT INTO export_jobs(id, owner_user_id, owner_username, camera_id, camera_name, requested_from, requested_to, state, progress, error, payload_json, created_at, updated_at) VALUES ('job1','u','joni',?,'כניסה',?,?,'done',1.0,NULL,?,'x','x')",
            (cam1["id"], ev_item["from_at"], ev_item["to_at"], json.dumps({"files": [], "output": "clip.mp4"})),
        )
        conn.execute("UPDATE case_items SET export_job_id = 'job1' WHERE id = ?", (ev_item["id"],))
    d = c.get(f"/api/v1/cases/{case['id']}").json()
    by = {i["id"]: i for i in d["items"]}
    assert by[ev_item["id"]]["preservation"] == "preserved" and by[ev_item["id"]]["export"]["download_ready"] is True and d["counts"]["preserved"] == 1
    assert c.get("/api/v1/cases").json()["cases"][0]["counts"]["preserved"] == 1
    assert c.post(f"/api/v1/cases/{case['id']}/items/{ev_item['id']}/preserve").json()["code"] == "already_preserving"
    assert c.post(f"/api/v1/cases/{case['id']}/items/{note['id']}/preserve").json()["code"] == "not_a_clip"

    # closed cases take no new items; items and cases can be removed
    closed = c.patch(f"/api/v1/cases/{case['id']}", json={"revision": 2, "status": "closed"}).json()
    assert closed["status"] == "closed" and closed["closed_at"] and closed["revision"] == 3
    assert c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "note", "note": "x"}).json()["code"] == "case_closed"
    assert c.delete(f"/api/v1/cases/{case['id']}/items/{clip['id']}").status_code == 204
    assert c.delete(f"/api/v1/cases/{case['id']}/items/{clip['id']}").status_code == 404
    assert c.get(f"/api/v1/cases/{case['id']}").json()["counts"]["items"] == 2
    assert c.delete(f"/api/v1/cases/{case['id']}").status_code == 204
    assert c.get(f"/api/v1/cases/{case['id']}").status_code == 404
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM case_items").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action LIKE 'case.%'").fetchone()[0] >= 6


def test_cases_preserve_without_nvr_and_permissions(client, settings):
    ids = seed_tree(client)
    cam = client.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    case = client.post("/api/v1/cases", json={"title": "t"}).json()
    clip = client.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "clip", "camera_id": cam["id"], "from_at": "2026-09-14T11:00:00Z", "to_at": "2026-09-14T11:01:00Z"}).json()
    assert client.post(f"/api/v1/cases/{case['id']}/items/{clip['id']}/preserve").status_code == 503
    assert client.get(f"/api/v1/cases/{case['id']}").json()["checked"] is False
    # a viewer reads nothing; an installation-wide operator reads and manages
    bind(client, settings, "ron", "viewer", "floor", ids["floor2"])
    assert client.get("/api/v1/cases", headers=as_user("ron")).status_code == 403
    assert client.post("/api/v1/cases", json={"title": "x"}, headers=as_user("ron")).status_code == 403
    bind(client, settings, "dan", "operator", "installation", "*")
    h = as_user("dan")
    lst = client.get("/api/v1/cases", headers=h).json()
    assert lst["can_manage"] is True and len(lst["cases"]) == 1
    assert client.post("/api/v1/cases", json={"title": "של דן"}, headers=h).status_code == 201
    assert client.get(f"/api/v1/cases/{case['id']}", headers=h).json()["items"][0]["kind"] == "clip"
