"""LOBBY-STYLES-2300 (owner decisions 2026-10-30): the six lobby notice-board styles - hi-tech lumen / axis / prism and classic-luxury
gallery / concierge / stone - are values of the existing `design` option (never a default), and their three behaviour settings
(`live_bg`, `systems_status`, `urgent_screen`) live next to it in the V2 option group (board value, else installation default, else the
factory value; 422 on an unknown value). No migration: board display JSON and settings rows only."""
from __future__ import annotations

import pytest

from conftest import as_user, bind
from smplwise.services.notices import model

API = "/api/v1"
LOBBY = ("lumen", "axis", "prism", "gallery", "concierge", "stone")
BEHAVIOUR = {"live_bg": "auto", "systems_status": "problems", "urgent_screen": "style"}


def _enable(client):
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200


def _board(client, slug="lobby"):
    r = client.post(f"{API}/notices/boards", json={"name": "לוח", "slug": slug})
    assert r.status_code == 200, r.text
    return r.json()


def _display(client, made):
    return client.get(f"{API}/notices/display/{made['board']['slug']}", headers={"X-Board-Token": made["token"]}).json()["board"]["display"]


def test_the_lobby_styles_are_designs_and_classic_stays_the_factory():
    assert model.DESIGNS == ("classic", "v2", "ink", "sign", *LOBBY)
    assert model.TV2_FACTORY["design"] == "classic"
    for s in LOBBY:
        assert model.normalize_display({"design": s}, strict=True)["design"] == s
    for bad in ("Lumen", "LUMEN", "lumen ", "hitech", "luxury", "stone2", "", 3, True):
        with pytest.raises(model.Invalid):
            model.normalize_display({"design": bad}, strict=True)


def test_the_behaviour_settings_have_the_owner_defaults():
    assert model.LIVE_BGS == ("auto", "full", "frozen", "off")
    assert model.SYSTEMS_STATUS == ("problems", "always")
    assert model.URGENT_SCREENS == ("style", "minute", "always")
    for k, v in BEHAVIOUR.items():
        assert model.TV2_FACTORY[k] == v
        assert model.SETTINGS_DEFAULTS[f"notices.tv2.{k}"] == v
    assert {k: model.tv2_defaults_doc(lambda a, d: d)[k] for k in BEHAVIOUR} == BEHAVIOUR
    # a stored value outside the list reads as the factory value
    stored = {"notices.tv2.live_bg": "turbo", "notices.tv2.systems_status": "always"}
    doc = model.tv2_defaults_doc(lambda k, d: stored.get(k, d))
    assert doc["live_bg"] == "auto" and doc["systems_status"] == "always"


@pytest.mark.parametrize("style", LOBBY)
def test_a_board_chooses_a_lobby_style_and_the_feed_carries_it(client, style):
    _enable(client)
    made = _board(client)
    assert _display(client, made)["design"] == "classic"  # none of them is a default for any board
    bid = made["board"]["id"]
    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"design": style}})
    assert r.status_code == 200 and r.json()["board"]["display"]["design"] == style
    assert _display(client, made)["design"] == style
    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"design": None}})
    assert r.status_code == 200 and "design" not in r.json()["board"]["display"]
    assert _display(client, made)["design"] == "classic"


@pytest.mark.parametrize("style", LOBBY)
def test_the_installation_default_can_be_a_lobby_style(client, style):
    _enable(client)
    made = _board(client)
    r = client.put(f"{API}/notices/tv-defaults", json={"design": style})
    assert r.status_code == 200 and r.json()["tv2_defaults"]["design"] == style
    assert _display(client, made)["design"] == style


def test_the_behaviour_settings_follow_the_default_until_the_board_chooses(client):
    _enable(client)
    made = _board(client)
    d = _display(client, made)
    assert {k: d[k] for k in BEHAVIOUR} == BEHAVIOUR  # the feed carries the effective value
    r = client.put(f"{API}/notices/tv-defaults", json={"live_bg": "frozen", "systems_status": "always", "urgent_screen": "minute"})
    assert r.status_code == 200
    assert r.json()["tv2_defaults"]["live_bg"] == "frozen"
    d = _display(client, made)
    assert (d["live_bg"], d["systems_status"], d["urgent_screen"]) == ("frozen", "always", "minute")
    bid = made["board"]["id"]
    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"live_bg": "off"}})
    assert r.status_code == 200 and r.json()["board"]["display"]["live_bg"] == "off"
    d = _display(client, made)
    assert (d["live_bg"], d["systems_status"]) == ("off", "always")
    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"live_bg": None}})
    assert r.status_code == 200 and "live_bg" not in r.json()["board"]["display"]
    assert _display(client, made)["live_bg"] == "frozen"


@pytest.mark.parametrize("bad", [{"design": "Lumen"}, {"design": "gallery2"}, {"live_bg": "on"}, {"live_bg": 1}, {"systems_status": "never"},
                                 {"systems_status": True}, {"urgent_screen": "full"}, {"urgent_screen": 0}])
def test_unknown_values_are_refused_on_a_board_and_in_the_defaults(client, bad):
    _enable(client)
    made = _board(client)
    assert client.patch(f"{API}/notices/boards/{made['board']['id']}", json={"display": bad}).status_code == 422
    assert client.put(f"{API}/notices/tv-defaults", json=bad).status_code == 422


def test_the_lobby_options_need_the_boards_permission(client, settings):
    _enable(client)
    bid = _board(client)["board"]["id"]
    bind(client, settings, "dana", "viewer", "installation", "*")
    assert client.patch(f"{API}/notices/boards/{bid}", json={"display": {"design": "stone"}}, headers=as_user("dana")).status_code == 403
    assert client.put(f"{API}/notices/tv-defaults", json={"live_bg": "off"}, headers=as_user("dana")).status_code == 403
    bind(client, settings, "omer", "notices_boards", "installation", "*")
    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"design": "lumen", "urgent_screen": "always"}}, headers=as_user("omer"))
    assert r.status_code == 200 and r.json()["board"]["display"]["urgent_screen"] == "always"


# ---------------------------------------------------------------- the day and the night building photo (luxury styles; no migration)

def _img(w=1200, h=800, color=(30, 80, 120)) -> bytes:
    import io

    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, format="JPEG", quality=70)
    return buf.getvalue()


def _put(client, bid, leaf, data):
    return client.put(f"{API}/notices/boards/{bid}/{leaf}", files={"file": ("p.jpg", data, "image/jpeg")})


def test_two_building_photos_day_and_night_share_the_table_and_replace_only_their_own(client, settings):
    from smplwise.db import Database
    _enable(client)
    made = _board(client)
    bid = made["board"]["id"]
    assert _put(client, bid, "photo", _img()).status_code == 200
    out = _put(client, bid, "photo-night", _img(color=(5, 10, 40))).json()
    assert out["photo"]["has"] is True and out["photo_night"]["has"] is True
    assert out["photo"]["stamp"] != out["photo_night"]["stamp"]
    # replacing one variant leaves the other alone, and never stacks
    assert _put(client, bid, "photo-night", _img(color=(9, 9, 9))).status_code == 200
    with Database(settings.db_path).connect() as c:
        rows = c.execute("SELECT l.position FROM notice_board_slides l JOIN notice_slides s ON s.id = l.slide_id WHERE s.kind = 'photo' AND l.board_id = ? ORDER BY 1", (bid,)).fetchall()
    assert [r[0] for r in rows] == [0, 1]
    assert client.get(f"{API}/notices/boards/{bid}/photo").status_code == 200
    assert client.get(f"{API}/notices/boards/{bid}/photo-night").status_code == 200
    out = client.delete(f"{API}/notices/boards/{bid}/photo-night").json()
    assert out["photo"]["has"] is True and out["photo_night"]["has"] is False
    assert client.get(f"{API}/notices/boards/{bid}/photo-night").status_code == 404
    assert client.get(f"{API}/notices/boards/{bid}/photo").status_code == 200
    out = client.delete(f"{API}/notices/boards/{bid}/photo").json()
    assert out["photo"]["has"] is False


@pytest.mark.parametrize("style,carried", [("classic", False), ("lumen", False), ("gallery", True), ("concierge", True), ("stone", True)])
def test_the_feed_carries_the_photos_for_the_luxury_styles_only(client, style, carried):
    _enable(client)
    made = _board(client)
    bid = made["board"]["id"]
    _put(client, bid, "photo", _img())
    _put(client, bid, "photo-night", _img(color=(5, 10, 40)))
    assert client.patch(f"{API}/notices/boards/{bid}", json={"display": {"design": style}}).status_code == 200
    d = _display(client, made)
    if carried:
        assert d["photo"].startswith("api/v1/notices/display/lobby/photo?v=")
        assert d["photo_night"].startswith("api/v1/notices/display/lobby/photo-night?v=")
        h = {"X-Board-Token": made["token"]}
        assert client.get(f"{API}/notices/display/lobby/photo-night", headers=h).status_code == 200
        assert client.get(f"{API}/notices/display/lobby/photo-night").status_code == 404  # no token
    else:
        assert "photo" not in d and "photo_night" not in d


def test_a_board_with_one_photo_carries_no_night_url(client):
    _enable(client)
    made = _board(client)
    bid = made["board"]["id"]
    _put(client, bid, "photo", _img())
    client.patch(f"{API}/notices/boards/{bid}", json={"display": {"design": "stone"}})
    d = _display(client, made)
    assert "photo" in d and "photo_night" not in d  # the TV darkens the one photo at night
