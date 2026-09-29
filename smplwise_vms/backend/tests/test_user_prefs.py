"""CR-013: GET/PUT /me/prefs - a user's own interface preferences (the navigation tab order), stored per user on the
server: defaults, normalization (unknown ids dropped, duplicates removed, missing tabs appended in the default order),
reset with null, closed key list, per-user isolation, and a user without any role may still keep their own order."""
from __future__ import annotations

from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app

DEFAULT = ["devices", "security", "explore", "wiskey"]


def test_defaults_then_save_normalize_and_reset(client: TestClient):
    r = client.get("/api/v1/me/prefs")
    assert r.status_code == 200
    body = r.json()
    assert body["prefs"]["nav.order"] == DEFAULT and body["stored"] == [] and body["updated_at"] is None

    r = client.put("/api/v1/me/prefs", json={"nav.order": ["wiskey", "security"]})
    assert r.status_code == 200
    assert r.json()["prefs"]["nav.order"] == ["wiskey", "security", "devices", "explore"]  # missing appended in default order
    assert r.json()["stored"] == ["nav.order"] and r.json()["updated_at"]

    # unknown ids and duplicates are dropped, never stored
    r = client.put("/api/v1/me/prefs", json={"nav.order": ["explore", "system", "explore", "<script>", "devices"]})
    assert r.json()["prefs"]["nav.order"] == ["explore", "devices", "security", "wiskey"]
    assert client.get("/api/v1/me/prefs").json()["prefs"]["nav.order"] == ["explore", "devices", "security", "wiskey"]

    # an empty body changes nothing; null resets to the default
    assert client.put("/api/v1/me/prefs", json={}).json()["prefs"]["nav.order"] == ["explore", "devices", "security", "wiskey"]
    r = client.put("/api/v1/me/prefs", json={"nav.order": None})
    assert r.json()["prefs"]["nav.order"] == DEFAULT and r.json()["stored"] == []


def test_closed_keys_and_shapes(client: TestClient):
    assert client.put("/api/v1/me/prefs", json={"theme": "dark"}).status_code == 422  # not free-form storage
    assert client.put("/api/v1/me/prefs", json={"nav.order": "devices"}).status_code == 422
    assert client.put("/api/v1/me/prefs", json={"nav.order": [1, 2]}).status_code == 422
    assert client.put("/api/v1/me/prefs", json={"nav.order": ["x" * 40]}).status_code == 422
    assert client.put("/api/v1/me/prefs", json={"nav.order": ["devices"] * 40}).status_code == 422
    assert client.get("/api/v1/me/prefs").json()["stored"] == []


def test_per_user_isolation_and_no_role_user(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")  # joni: the bootstrap administrator
    bind(c, settings, "dana", "viewer", "installation", "*")
    assert c.put("/api/v1/me/prefs", json={"nav.order": ["security", "explore"]}).status_code == 200
    # dana still has the default; her own change does not touch joni's
    assert c.get("/api/v1/me/prefs", headers=as_user("dana")).json()["prefs"]["nav.order"] == DEFAULT
    assert c.put("/api/v1/me/prefs", headers=as_user("dana"), json={"nav.order": ["wiskey"]}).status_code == 200
    assert c.get("/api/v1/me/prefs").json()["prefs"]["nav.order"] == ["security", "explore", "devices", "wiskey"]
    assert c.get("/api/v1/me/prefs", headers=as_user("dana")).json()["prefs"]["nav.order"] == ["wiskey", "devices", "security", "explore"]
    # a signed-in user without any role (the shell's "no access" gate) may keep their own order; it grants nothing
    r = c.put("/api/v1/me/prefs", headers=as_user("guest"), json={"nav.order": ["explore"]})
    assert r.status_code == 200 and r.json()["prefs"]["nav.order"][0] == "explore"
    assert c.get("/api/v1/me", headers=as_user("guest")).json()["has_access"] is False


def test_unreadable_row_is_the_default(settings):
    c = TestClient(create_app(settings))
    me = c.get("/api/v1/me").json()["user"]["id"]
    with c.app.state.db.connection() as conn:
        conn.execute("INSERT INTO user_prefs(user_id, key, value_json, updated_at) VALUES (?, 'nav.order', '{broken', '2026-09-30T00:00:00Z')", (me,))
    body = c.get("/api/v1/me/prefs").json()
    assert body["prefs"]["nav.order"] == DEFAULT and body["stored"] == []
