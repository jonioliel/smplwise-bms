"""CR-013: GET/PUT /me/prefs - a user's own interface preferences (the navigation tab order), stored per user on the
server: defaults, normalization (unknown ids dropped, duplicates removed, missing tabs appended in the default order),
reset with null, closed key list, per-user isolation, and a user without any role may still keep their own order."""
from __future__ import annotations

from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app

DEFAULT = ["devices", "security", "explore", "multimedia", "wiskey", "infra"]


def test_defaults_then_save_normalize_and_reset(client: TestClient):
    r = client.get("/api/v1/me/prefs")
    assert r.status_code == 200
    body = r.json()
    assert body["prefs"]["nav.order"] == DEFAULT and body["stored"] == [] and body["updated_at"] is None

    r = client.put("/api/v1/me/prefs", json={"nav.order": ["wiskey", "security"]})
    assert r.status_code == 200
    assert r.json()["prefs"]["nav.order"] == ["wiskey", "security", "devices", "explore", "multimedia", "infra"]  # missing appended in default order
    assert r.json()["stored"] == ["nav.order"] and r.json()["updated_at"]

    # unknown ids and duplicates are dropped, never stored
    r = client.put("/api/v1/me/prefs", json={"nav.order": ["explore", "system", "explore", "<script>", "devices"]})
    assert r.json()["prefs"]["nav.order"] == ["explore", "devices", "security", "multimedia", "wiskey", "infra"]
    assert client.get("/api/v1/me/prefs").json()["prefs"]["nav.order"] == ["explore", "devices", "security", "multimedia", "wiskey", "infra"]

    # an empty body changes nothing; null resets to the default
    assert client.put("/api/v1/me/prefs", json={}).json()["prefs"]["nav.order"] == ["explore", "devices", "security", "multimedia", "wiskey", "infra"]
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
    assert c.get("/api/v1/me/prefs").json()["prefs"]["nav.order"] == ["security", "explore", "devices", "multimedia", "wiskey", "infra"]
    assert c.get("/api/v1/me/prefs", headers=as_user("dana")).json()["prefs"]["nav.order"] == ["wiskey", "devices", "security", "explore", "multimedia", "infra"]
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


def test_wiskey_start_choices_default_null_validate_normalize_and_reset(client: TestClient):
    """WisKey rc.37: `wiskey.density` (auto|4|6|8|9|12) and `wiskey.wall` (4|9|12) are the user's own start choices for the
    embedded panel; null = follow the installation's default."""
    body = client.get("/api/v1/me/prefs").json()
    assert body["prefs"]["wiskey.density"] is None and body["prefs"]["wiskey.wall"] is None and body["stored"] == []

    r = client.put("/api/v1/me/prefs", json={"wiskey.density": 12, "wiskey.wall": "9"})  # a number and a string are the same value
    assert r.status_code == 200, r.text
    assert r.json()["prefs"]["wiskey.density"] == "12" and r.json()["prefs"]["wiskey.wall"] == "9"
    assert sorted(r.json()["stored"]) == ["wiskey.density", "wiskey.wall"]
    assert client.put("/api/v1/me/prefs", json={"wiskey.density": "auto"}).json()["prefs"]["wiskey.density"] == "auto"
    for ok in ("4", "6", "8", "9", "12", "auto"):
        assert client.put("/api/v1/me/prefs", json={"wiskey.density": ok}).json()["prefs"]["wiskey.density"] == ok
    for ok in ("4", "9", "12"):
        assert client.put("/api/v1/me/prefs", json={"wiskey.wall": ok}).json()["prefs"]["wiskey.wall"] == ok

    # a partial update does not touch the other keys; an empty body changes nothing
    client.put("/api/v1/me/prefs", json={"nav.order": ["wiskey"]})
    assert client.put("/api/v1/me/prefs", json={"wiskey.wall": "4"}).json()["prefs"]["wiskey.density"] == "auto"
    assert client.put("/api/v1/me/prefs", json={}).json()["prefs"]["wiskey.wall"] == "4"

    # reset one key: back to the installation's default (null); the others stay
    r = client.put("/api/v1/me/prefs", json={"wiskey.density": None})
    assert r.json()["prefs"]["wiskey.density"] is None and r.json()["prefs"]["wiskey.wall"] == "4"
    assert "wiskey.density" not in r.json()["stored"] and "wiskey.wall" in r.json()["stored"]


def test_wiskey_start_choices_reject_anything_else(client: TestClient):
    for bad in ({"wiskey.density": "5"}, {"wiskey.density": 3}, {"wiskey.density": ""}, {"wiskey.density": "12px"}, {"wiskey.density": True},
                {"wiskey.density": ["12"]}, {"wiskey.density": {"n": 12}}, {"wiskey.wall": "auto"}, {"wiskey.wall": "6"}, {"wiskey.wall": "8"},
                {"wiskey.wall": 16}, {"wiskey.wall": "9 "+"x"}, {"wiskey.wall": [9]}):
        assert client.put("/api/v1/me/prefs", json=bad).status_code == 422, bad
    assert client.get("/api/v1/me/prefs").json()["stored"] == []  # nothing was stored


def test_wiskey_start_choices_are_per_user(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    assert c.put("/api/v1/me/prefs", json={"wiskey.density": "8", "wiskey.wall": "12"}).status_code == 200
    dana = c.get("/api/v1/me/prefs", headers=as_user("dana")).json()
    assert dana["prefs"]["wiskey.density"] is None and dana["prefs"]["wiskey.wall"] is None
    assert c.put("/api/v1/me/prefs", headers=as_user("dana"), json={"wiskey.density": "4"}).json()["prefs"]["wiskey.density"] == "4"
    joni = c.get("/api/v1/me/prefs").json()["prefs"]
    assert joni["wiskey.density"] == "8" and joni["wiskey.wall"] == "12"


def test_an_unreadable_stored_wiskey_choice_is_the_default_not_an_error(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        me = c.get("/api/v1/me").json()
        uid = me["user_id"] if "user_id" in me else me["user"]["id"]
        with app.state.db.connection() as conn:
            conn.execute("INSERT INTO user_prefs(user_id, key, value_json, updated_at) VALUES (?,?,?,?)", (uid, "wiskey.density", '"7"', "2026-01-01T00:00:00Z"))
        body = c.get("/api/v1/me/prefs").json()
        assert body["prefs"]["wiskey.density"] is None and "wiskey.density" not in body["stored"]
