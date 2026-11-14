"""CR-015: the screens page layout (services/media_layout.py, routes `/multimedia/layout`): normalisation and limits, the optimistic revision
(409 `revision_conflict`), the permission, reset, unknown keys, and the closed personal shape."""
from __future__ import annotations

import json

import media_seed as seed
import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import media_layout as ml

K = [f"{i:032x}" for i in range(1, 400)]


def test_the_default_layout_and_normalisation_fill_defaults():
    assert ml.default_layout() == {"version": 1, "group_by": "floor", "floor_order": [], "pinned": [], "order": [], "cards": {}}
    out = ml.normalise_layout({"group_by": "area", "pinned": [K[0], K[0], K[1]], "order": [K[2], K[1]], "floor_order": ["ground", "ground", "upper"],
                               "cards": {K[0]: {"size": "l"}, K[1]: {"on": False, "phone_on": True, "phone_size": "s"}}})
    assert out == {"version": 1, "group_by": "area", "floor_order": ["ground", "upper"], "pinned": [K[0], K[1]], "order": [K[2], K[1]],
                   "cards": {K[0]: {"on": True, "size": "l", "phone_on": None, "phone_size": None}, K[1]: {"on": False, "size": "m", "phone_on": True, "phone_size": "s"}}}
    assert ml.normalise_layout({}) == ml.default_layout()


@pytest.mark.parametrize("bad", [
    [], "x", {"version": 2}, {"version": True}, {"group_by": "street"}, {"floor_order": "ground"}, {"floor_order": [1]}, {"floor_order": ["a\nb"]}, {"floor_order": ["x" * 129]},
    {"pinned": [K[0]] * 1 + ["short"]}, {"pinned": K[:25]}, {"order": K[:300] + [K[300]]}, {"order": ["G" * 32]}, {"cards": []}, {"cards": {"short": {}}},
    {"cards": {K[0]: {"size": "xl"}}}, {"cards": {K[0]: {"phone_size": "l"}}}, {"cards": {K[0]: {"on": "yes"}}}, {"cards": {K[0]: {"color": "red"}}}, {"surprise": 1},
    {"cards": {k: {} for k in K[:301]}},
])
def test_the_layout_is_closed_and_bounded(bad):
    with pytest.raises(ValueError):
        ml.normalise_layout(bad)


def test_the_limits_are_the_contracts():
    ml.normalise_layout({"pinned": K[:24], "order": K[:300], "cards": {k: {} for k in K[:300]}, "floor_order": [f"f{i}" for i in range(100)]})
    assert (ml.MAX_KEYS, ml.MAX_PINNED) == (300, 24)


def test_the_personal_override_is_group_order_and_per_card_on_size_only():
    assert ml.normalise_personal({}) == {"group_by": None, "order": None, "cards": {}}
    out = ml.normalise_personal({"group_by": "none", "order": [K[0]], "cards": {K[0]: {"on": False}, K[1]: {"size": "s"}, K[2]: {}}})
    assert out == {"group_by": "none", "order": [K[0]], "cards": {K[0]: {"on": False}, K[1]: {"size": "s"}, K[2]: {}}}
    for bad in ({"pinned": []}, {"cards": {K[0]: {"phone_on": True}}}, {"group_by": "x"}, {"order": "x"}, {"cards": {K[0]: {"size": "xl"}}}, {"cards": {"x": {}}}, []):
        with pytest.raises(ValueError):
            ml.normalise_personal(bad)
    assert ml.personal_is_empty(None) and ml.personal_is_empty({"group_by": None, "order": None, "cards": {}}) and not ml.personal_is_empty({"group_by": "area", "order": None, "cards": {}})


def test_prune_keys_removes_only_the_named_devices():
    lay = ml.normalise_layout({"pinned": [K[0], K[1]], "order": [K[0], K[1], K[2]], "cards": {K[0]: {}, K[1]: {}, K[2]: {}}})
    out = ml.prune_keys(lay, {K[1]})
    assert out["pinned"] == [K[0]] and out["order"] == [K[0], K[2]] and set(out["cards"]) == {K[0], K[2]} and lay["pinned"] == [K[0], K[1]]


@pytest.fixture()
def m(settings):
    app = create_app(settings)
    c = TestClient(app)
    seed.install(c)
    seed.approve_all(c)
    return app, c, settings


def test_get_put_delete_with_the_optimistic_revision(m):
    app, c, settings = m
    first = c.get("/api/v1/multimedia/layout").json()
    assert first == {"installation": ml.default_layout(), "personal": None, "revision": 0, "can_edit": True, "can_personalize": True}
    a, b = seed.key_of(c, "media_player.tv_living"), seed.key_of(c, "media_player.lg_office")
    lay = {"version": 1, "group_by": "area", "pinned": [a], "order": [b, a], "floor_order": ["upper", "ground"], "cards": {a: {"on": True, "size": "l"}, b: {"on": False}}}
    r = c.put("/api/v1/multimedia/layout", json={"layout": lay, "base_revision": 0})
    assert r.status_code == 200, r.text
    saved = r.json()
    assert saved["revision"] == 1 and saved["installation"]["group_by"] == "area" and saved["installation"]["cards"][b] == {"on": False, "size": "m", "phone_on": None, "phone_size": None}
    assert c.get("/api/v1/multimedia/layout").json()["installation"] == saved["installation"]
    stale = c.put("/api/v1/multimedia/layout", json={"layout": lay, "base_revision": 0})
    assert (stale.status_code, stale.json()["code"]) == (409, "revision_conflict") and c.get("/api/v1/multimedia/layout").json()["revision"] == 1
    assert c.put("/api/v1/multimedia/layout", json={"layout": {**lay, "group_by": "none"}, "base_revision": 1}).json()["revision"] == 2
    # a vanished device key is kept on write (it may only be absent for a while)
    ghost = "a" * 32
    assert c.put("/api/v1/multimedia/layout", json={"layout": {"order": [ghost]}, "base_revision": 2}).json()["installation"]["order"] == [ghost]
    # reset: back to the automatic layout, and the revision keeps moving
    assert c.delete("/api/v1/multimedia/layout").status_code == 204
    after = c.get("/api/v1/multimedia/layout").json()
    assert after["installation"] == ml.default_layout() and after["revision"] == 4
    with app.state.db.connection(mode="read") as conn:
        rows = [(r["action"], json.loads(r["details_json"])) for r in conn.execute("SELECT action, details_json FROM audit_log WHERE action LIKE 'media.layout.%' ORDER BY id")]
    assert [a for a, _d in rows] == ["media.layout.update"] * 3 + ["media.layout.reset"] and rows[0][1] == {"revision": 1}
    assert "cards" not in json.dumps(rows), "the layout itself is never in the audit row"


def test_invalid_layouts_are_422_and_change_nothing(m):
    app, c, settings = m
    for bad in ({"group_by": "street"}, {"order": ["x"]}, {"cards": {"x": {}}}, {"surprise": True}):
        assert c.put("/api/v1/multimedia/layout", json={"layout": bad, "base_revision": 0}).status_code == 422
    assert c.put("/api/v1/multimedia/layout", json={"layout": {}}).status_code == 422, "base_revision is required"
    assert c.put("/api/v1/multimedia/layout", json={"layout": {}, "base_revision": -1}).status_code == 422
    assert c.put("/api/v1/multimedia/layout", json={"layout": {}, "base_revision": 0, "extra": 1}).status_code == 422
    assert c.get("/api/v1/multimedia/layout").json()["revision"] == 0


def test_only_media_layout_holders_write_and_everyone_with_media_read_reads(m):
    app, c, settings = m
    for name, role in (("olga", "operator"), ("vera", "viewer")):
        bind(c, settings, name, role, "installation", "*")
    for name in ("olga", "vera"):
        h = as_user(name)
        assert c.get("/api/v1/multimedia/layout", headers=h).json()["can_edit"] is False
        r = c.put("/api/v1/multimedia/layout", json={"layout": {}, "base_revision": 0}, headers=h)
        assert (r.status_code, r.json()["code"]) == (403, "forbidden")
        assert c.delete("/api/v1/multimedia/layout", headers=h).status_code == 403
    bind(c, settings, "sam", "site_admin", "installation", "*")
    sam = as_user("sam")
    assert c.get("/api/v1/multimedia/layout", headers=sam).json()["can_edit"] is True
    assert c.put("/api/v1/multimedia/layout", json={"layout": {"group_by": "none"}, "base_revision": 0}, headers=sam).status_code == 200
    assert c.get("/api/v1/multimedia/layout", headers=as_user("olga")).json()["installation"]["group_by"] == "none"
    # the body is JSON only, and the permission comes before the body
    assert c.put("/api/v1/multimedia/layout", data="x", headers={**as_user("olga"), "content-type": "text/plain"}).status_code == 403
    assert c.put("/api/v1/multimedia/layout", data="x", headers={"content-type": "text/plain"}).status_code == 415
    with app.state.db.connection(mode="read") as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'media.layout' AND decision = 'denied'").fetchone()[0]
    assert denied >= 5, "every refusal is audited"


def test_a_layout_change_tells_the_open_clients_to_refetch(m):
    from smplwise.services import ha_sync
    import queue

    app, c, settings = m
    q = ha_sync.subscribe()
    try:
        c.put("/api/v1/multimedia/layout", json={"layout": {"group_by": "area"}, "base_revision": 0})
        c.put("/api/v1/multimedia/remote-default", json={"sections": [{"id": s, "on": True} for s in ml.REMOTE_SECTIONS], "more": []})
        frames = []
        while True:
            try:
                frames.append(q.get_nowait())
            except queue.Empty:
                break
    finally:
        ha_sync.unsubscribe(q)
    assert [f["reason"] for f in frames if f.get("type") == "media_devices_changed"] == ["layout", "curation"]
