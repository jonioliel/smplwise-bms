"""BOARDV2-297: the V2 notice board's options - the design (classic / v2), the V2 layout (side / strip / slide; the installation value
is the default layout), the tenant logo size, the portrait order and the "next arrivals" row.

Same rules as the TVOPT-295 options: a board's display JSON holds a key only when the board chose its own value; everything else follows
the installation defaults (`notices.tv2.*`, PUT /notices/tv-defaults, permission notices.boards), which start at the board as it was
(design classic). The TV feed always carries the effective value."""
from __future__ import annotations

import pytest

from conftest import as_user, bind
from smplwise.services.notices import model

API = "/api/v1"
KEYS = ("design", "board_layout", "co_size", "portrait_order", "next_row")
FACTORY = {"design": "classic", "board_layout": "side", "co_size": "auto", "portrait_order": "bus", "next_row": "show"}


def _enable(client):
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200


def _board(client, slug="lobby", display=None):
    body = {"name": "לוח", "slug": slug, **({"display": display} if display is not None else {})}
    r = client.post(f"{API}/notices/boards", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _fd(client, slug, token):
    d = client.get(f"{API}/notices/display/{slug}", headers={"X-Board-Token": token}).json()["board"]["display"]
    return {k: d[k] for k in KEYS}


def test_the_v2_choices_and_their_factory_defaults():
    assert model.DESIGNS == ("classic", "v2")
    assert model.BOARD_LAYOUTS == ("side", "strip", "slide")
    assert model.CO_SIZES == ("auto", "s", "m", "l", "xl")
    assert model.PORTRAIT_ORDERS == ("bus", "notices")
    assert model.NEXT_ROWS == ("show", "hide")
    assert model.TV2_FACTORY == FACTORY
    assert {k: model.SETTINGS_DEFAULTS[f"notices.tv2.{k}"] for k in KEYS} == FACTORY
    assert model.tv2_defaults_doc(lambda k, d: d) == FACTORY
    # the TVOPT-295 document keeps only its own keys (five, plus idle_logo from TVNOTICE2-297); no V2 key leaks into it
    assert set(model.tv_defaults_doc(lambda k, d: d)) == {"header", "updated", "space", "night_logo", "weather_days", "idle_logo"}


def test_a_board_holds_only_its_own_v2_choices_and_the_feed_resolves_them():
    assert not set(KEYS) & set(model.normalize_display({}))
    d = model.normalize_display({"design": "v2", "board_layout": "strip", "co_size": None})
    assert (d["design"], d["board_layout"]) == ("v2", "strip") and "co_size" not in d
    eff = model.effective_display(d, {"co_size": "xl", "board_layout": "slide"})
    assert {k: eff[k] for k in KEYS} == {**FACTORY, "design": "v2", "board_layout": "strip", "co_size": "xl"}
    with pytest.raises(model.Invalid):
        model.normalize_display({"design": "v3"}, strict=True)
    with pytest.raises(model.Invalid):
        model.normalize_display({"co_size": 2}, strict=True)
    assert model.tv_defaults_values({"design": "v2", "next_row": "hide"}) == {"notices.tv2.design": "v2", "notices.tv2.next_row": "hide"}
    stored = {"notices.tv2.board_layout": "strip", "notices.tv2.co_size": "huge"}
    assert model.tv2_defaults_doc(lambda k, dflt: stored.get(k, dflt)) == {**FACTORY, "board_layout": "strip"}  # a bad stored value reads as the factory one


def test_boards_follow_the_v2_defaults_until_they_choose(client):
    _enable(client)
    old = _board(client, "lobby")
    assert _fd(client, "lobby", old["token"]) == FACTORY  # nothing changes until an administrator picks V2
    r = client.get(f"{API}/notices/tv-defaults")
    assert r.status_code == 200 and r.json()["tv2_defaults"] == FACTORY
    assert client.get(f"{API}/notices/settings").json()["settings"]["tv2_defaults"] == FACTORY

    want = {"design": "v2", "board_layout": "strip", "co_size": "l", "portrait_order": "notices", "next_row": "hide"}
    r = client.put(f"{API}/notices/tv-defaults", json=want)
    assert r.status_code == 200 and r.json()["tv2_defaults"] == want
    assert _fd(client, "lobby", old["token"]) == want
    bid = old["board"]["id"]
    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"design": "classic", "board_layout": "slide"}})
    assert r.status_code == 200
    assert _fd(client, "lobby", old["token"]) == {**want, "design": "classic", "board_layout": "slide"}
    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"board_layout": None}})
    assert r.status_code == 200 and "board_layout" not in r.json()["board"]["display"]
    assert _fd(client, "lobby", old["token"])["board_layout"] == "strip"  # back to the default layout


@pytest.mark.parametrize("bad", [{"design": "v3"}, {"board_layout": "top"}, {"co_size": "xxl"}, {"portrait_order": 1}, {"next_row": True}])
def test_bad_v2_values_are_refused(client, bad):
    _enable(client)
    made = _board(client)
    assert client.patch(f"{API}/notices/boards/{made['board']['id']}", json={"display": bad}).status_code == 422
    assert client.put(f"{API}/notices/tv-defaults", json=bad).status_code == 422


def test_the_v2_options_need_the_boards_permission(client, settings):
    _enable(client)
    bid = _board(client)["board"]["id"]
    bind(client, settings, "dana", "viewer", "installation", "*")
    assert client.patch(f"{API}/notices/boards/{bid}", json={"display": {"design": "v2"}}, headers=as_user("dana")).status_code == 403
    assert client.put(f"{API}/notices/tv-defaults", json={"design": "v2"}, headers=as_user("dana")).status_code == 403
    bind(client, settings, "omer", "notices_boards", "installation", "*")
    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"design": "v2", "co_size": "xl"}}, headers=as_user("omer"))
    assert r.status_code == 200 and r.json()["board"]["display"]["co_size"] == "xl"
    r = client.put(f"{API}/notices/tv-defaults", json={"board_layout": "slide"}, headers=as_user("omer"))
    assert r.status_code == 200 and r.json()["tv2_defaults"]["board_layout"] == "slide"
