from __future__ import annotations

from conftest import as_user, bind, seed_tree


def test_manual_registration_and_visibility(client, settings):
    ids = seed_tree(client)
    c1 = client.post("/api/v1/cameras", json={"channel": 1, "alias": "כניסה"}).json()
    client.post("/api/v1/cameras", json={"channel": 2, "alias": "לובי"})
    assert client.post("/api/v1/cameras", json={"channel": 1, "alias": "כניסה ראשית"}).json()["id"] == c1["id"], "same channel keeps its id"
    all_cams = client.get("/api/v1/cameras").json()
    assert [c["channel"] for c in all_cams["cameras"]] == [1, 2] and all_cams["can_sync"] is True

    # viewer of floor 2 sees only cameras anchored on floor 2
    bind(client, settings, "ron", "viewer", "floor", ids["floor2"])
    assert client.get("/api/v1/cameras", headers=as_user("ron")).json()["cameras"] == []


def test_sync_without_nvr_configuration(client):
    r = client.post("/api/v1/cameras/sync")
    assert r.status_code == 503 and r.json()["code"] == "source_not_configured"
