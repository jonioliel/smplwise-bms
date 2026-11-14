"""NOTICEBOARD-STYLES-2300 (release 2.30.0): the two maintenance-area notice-board styles "ink" (e-paper station display) and "sign"
(wayfinding signage) are values of the existing `design` option, chosen like classic / v2: on a board (PATCH /notices/boards/<id>) or as the
installation default (PUT /notices/tv-defaults, setting `notices.tv2.design`). Neither is a default: the factory stays `classic`, an unknown
value is refused, and the TV feed carries the effective value. No migration: the value lives in the board's display JSON / a settings row."""
from __future__ import annotations

import pytest

from conftest import as_user, bind
from smplwise.services.notices import model

API = "/api/v1"


def _enable(client):
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200


def _board(client, slug="lobby"):
    r = client.post(f"{API}/notices/boards", json={"name": "לוח", "slug": slug})
    assert r.status_code == 200, r.text
    return r.json()


def _design(client, made):
    d = client.get(f"{API}/notices/display/{made['board']['slug']}", headers={"X-Board-Token": made["token"]}).json()["board"]["display"]
    return d["design"]


def test_the_designs_are_classic_v2_ink_sign_and_classic_stays_the_factory():
    assert model.DESIGNS[:4] == ("classic", "v2", "ink", "sign")
    assert model.TV2_FACTORY["design"] == "classic"
    assert model.normalize_display({"design": "ink"}, strict=True)["design"] == "ink"
    assert model.normalize_display({"design": "sign"}, strict=True)["design"] == "sign"
    for bad in ("Ink", "SIGN", "ink ", "e-paper", "", 3):
        with pytest.raises(model.Invalid):
            model.normalize_display({"design": bad}, strict=True)


@pytest.mark.parametrize("style", ["ink", "sign"])
def test_a_board_chooses_the_style_and_the_feed_carries_it(client, style):
    _enable(client)
    made = _board(client)
    assert _design(client, made) == "classic"  # neither style is a default for any board
    bid = made["board"]["id"]
    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"design": style}})
    assert r.status_code == 200 and r.json()["board"]["display"]["design"] == style
    assert _design(client, made) == style
    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"design": None}})  # back to "use the default"
    assert r.status_code == 200 and "design" not in r.json()["board"]["display"]
    assert _design(client, made) == "classic"


@pytest.mark.parametrize("style", ["ink", "sign"])
def test_the_installation_default_can_be_a_style_and_a_board_can_override_it(client, style):
    _enable(client)
    made = _board(client)
    r = client.put(f"{API}/notices/tv-defaults", json={"design": style})
    assert r.status_code == 200 and r.json()["tv2_defaults"]["design"] == style
    assert _design(client, made) == style
    r = client.patch(f"{API}/notices/boards/{made['board']['id']}", json={"display": {"design": "v2"}})
    assert r.status_code == 200
    assert _design(client, made) == "v2"


@pytest.mark.parametrize("bad", ["Ink", "e-paper", "sign2", 7, True])
def test_other_values_are_refused_on_a_board_and_in_the_defaults(client, bad):
    _enable(client)
    made = _board(client)
    assert client.patch(f"{API}/notices/boards/{made['board']['id']}", json={"display": {"design": bad}}).status_code == 422
    assert client.put(f"{API}/notices/tv-defaults", json={"design": bad}).status_code == 422


def test_choosing_a_style_needs_the_boards_permission(client, settings):
    _enable(client)
    bid = _board(client)["board"]["id"]
    bind(client, settings, "dana", "viewer", "installation", "*")
    assert client.patch(f"{API}/notices/boards/{bid}", json={"display": {"design": "ink"}}, headers=as_user("dana")).status_code == 403
    assert client.put(f"{API}/notices/tv-defaults", json={"design": "sign"}, headers=as_user("dana")).status_code == 403
    bind(client, settings, "omer", "notices_boards", "installation", "*")
    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"design": "sign"}}, headers=as_user("omer"))
    assert r.status_code == 200 and r.json()["board"]["display"]["design"] == "sign"
