"""TV-SETTINGS-2380: the two settings the TV page reads since TV-FIT-2380 - `portrait_chips` (rows | drop) and `safe_margin` (a whole
percent 0..5 of each side). Same mechanism as the other TV board options: the installation default (`notices.tv2.*`,
PUT /notices/tv-defaults) and a board's own choice (its display JSON); the TV feed carries the effective value; both need
notices.boards and are audited."""
from __future__ import annotations

import pytest

from conftest import as_user, bind
from smplwise.services.notices import model

API = "/api/v1"
FACTORY = {"portrait_chips": "rows", "safe_margin": 0}


def _enable(client):
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200


def _board(client, slug="lobby"):
    r = client.post(f"{API}/notices/boards", json={"name": "לוח", "slug": slug})
    assert r.status_code == 200, r.text
    return r.json()


def _fd(client, slug, token):
    d = client.get(f"{API}/notices/display/{slug}", headers={"X-Board-Token": token}).json()["board"]["display"]
    return {k: d[k] for k in FACTORY}


def _audit(client, action):
    import json
    with client.app.state.db.connection(mode="read") as conn:
        return [json.loads(r["details_json"] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]


def test_the_choices_and_their_factory_defaults():
    assert model.PORTRAIT_CHIPS == ("rows", "drop")
    assert model.SAFE_MARGINS == (0, 1, 2, 3, 4, 5)
    assert {k: model.TV2_FACTORY[k] for k in FACTORY} == FACTORY
    assert {k: model.SETTINGS_DEFAULTS[f"notices.tv2.{k}"] for k in FACTORY} == {k: str(v) for k, v in FACTORY.items()}
    assert {k: model.tv2_defaults_doc(lambda k, d: d)[k] for k in FACTORY} == FACTORY
    assert model.TV_FIT_KEYS == tuple(FACTORY)


@pytest.mark.parametrize("key,ok", [("portrait_chips", "rows"), ("portrait_chips", "drop"), *[("safe_margin", n) for n in range(6)]])
def test_valid_values_are_taken(key, ok):
    assert model.tv_value_ok(key, ok)
    assert model.tv_defaults_values({key: ok}) == {f"notices.tv2.{key}": str(ok)}
    assert model.normalize_display({key: ok}, strict=True)[key] == ok


@pytest.mark.parametrize("bad", [
    {"portrait_chips": "row"}, {"portrait_chips": ""}, {"portrait_chips": 1}, {"portrait_chips": True},
    {"safe_margin": -1}, {"safe_margin": 6}, {"safe_margin": 2.5}, {"safe_margin": 3.0}, {"safe_margin": "3"}, {"safe_margin": True}, {"safe_margin": False}, {"safe_margin": 100},
])
def test_bad_values_are_refused_by_the_model(bad):
    with pytest.raises(model.Invalid):
        model.tv_defaults_values(bad)
    with pytest.raises(model.Invalid):
        model.normalize_display(bad, strict=True)
    assert not set(bad) & set(model.normalize_display(bad))  # a stored bad value is dropped (follows the default), never sent to the TV


def test_a_stored_bad_default_reads_as_the_factory_value():
    stored = {"notices.tv2.safe_margin": "9", "notices.tv2.portrait_chips": "tight"}
    assert {k: model.tv2_defaults_doc(lambda k, d: stored.get(k, d))[k] for k in FACTORY} == FACTORY
    stored = {"notices.tv2.safe_margin": "-1"}
    assert model.tv2_defaults_doc(lambda k, d: stored.get(k, d))["safe_margin"] == 0
    stored = {"notices.tv2.safe_margin": "4", "notices.tv2.portrait_chips": "drop"}
    assert {k: model.tv2_defaults_doc(lambda k, d: stored.get(k, d))[k] for k in FACTORY} == {"portrait_chips": "drop", "safe_margin": 4}


def test_a_board_holds_only_its_own_choice_and_the_effective_display_resolves_it():
    assert not set(FACTORY) & set(model.normalize_display({}))
    d = model.normalize_display({"portrait_chips": "drop", "safe_margin": None})
    assert d["portrait_chips"] == "drop" and "safe_margin" not in d
    eff = model.effective_display(d, {"safe_margin": 3, "portrait_chips": "rows"})
    assert {k: eff[k] for k in FACTORY} == {"portrait_chips": "drop", "safe_margin": 3}
    assert {k: model.effective_display({}, {})[k] for k in FACTORY} == FACTORY


def test_boards_follow_the_defaults_until_they_choose(client):
    _enable(client)
    made = _board(client)
    tok, bid = made["token"], made["board"]["id"]
    assert _fd(client, "lobby", tok) == FACTORY  # nothing changes for a board that never heard of the settings
    d = client.get(f"{API}/notices/tv-defaults").json()["tv2_defaults"]
    assert {k: d[k] for k in FACTORY} == FACTORY
    d = client.get(f"{API}/notices/settings").json()["settings"]["tv2_defaults"]
    assert {k: d[k] for k in FACTORY} == FACTORY

    r = client.put(f"{API}/notices/tv-defaults", json={"portrait_chips": "drop", "safe_margin": 3})
    assert r.status_code == 200 and (r.json()["tv2_defaults"]["portrait_chips"], r.json()["tv2_defaults"]["safe_margin"]) == ("drop", 3)
    assert _fd(client, "lobby", tok) == {"portrait_chips": "drop", "safe_margin": 3}

    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"portrait_chips": "rows", "safe_margin": 0}})  # the board's own 0 beats a default of 3
    assert r.status_code == 200
    assert _fd(client, "lobby", tok) == FACTORY
    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"safe_margin": None}})
    assert r.status_code == 200 and "safe_margin" not in r.json()["board"]["display"]
    assert _fd(client, "lobby", tok) == {"portrait_chips": "rows", "safe_margin": 3}  # back to the installation value
    # the Settings preview (the TV's payload through the session, with a draft) carries them as well
    r = client.post(f"{API}/notices/boards/{bid}/preview", json={"display": {"safe_margin": 5}})
    assert r.status_code == 200 and r.json()["board"]["display"]["safe_margin"] == 5


@pytest.mark.parametrize("bad", [{"portrait_chips": "row"}, {"portrait_chips": 1}, {"safe_margin": 6}, {"safe_margin": -1}, {"safe_margin": 2.5}, {"safe_margin": "3"}, {"safe_margin": True}])
def test_bad_values_are_refused_by_the_api(client, bad):
    _enable(client)
    made = _board(client)
    assert client.patch(f"{API}/notices/boards/{made['board']['id']}", json={"display": bad}).status_code == 422
    assert client.put(f"{API}/notices/tv-defaults", json=bad).status_code == 422
    d = client.get(f"{API}/notices/tv-defaults").json()["tv2_defaults"]
    assert {k: d[k] for k in FACTORY} == FACTORY  # a refused save changes nothing


def test_both_need_the_boards_permission(client, settings):
    _enable(client)
    bid = _board(client)["board"]["id"]
    bind(client, settings, "dana", "viewer", "installation", "*")
    assert client.patch(f"{API}/notices/boards/{bid}", json={"display": {"safe_margin": 2}}, headers=as_user("dana")).status_code == 403
    assert client.put(f"{API}/notices/tv-defaults", json={"safe_margin": 2}, headers=as_user("dana")).status_code == 403
    assert client.put(f"{API}/notices/tv-defaults", json={"portrait_chips": "drop"}, headers=as_user("dana")).status_code == 403
    bind(client, settings, "omer", "notices_boards", "installation", "*")
    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"portrait_chips": "drop", "safe_margin": 2}}, headers=as_user("omer"))
    assert r.status_code == 200 and (r.json()["board"]["display"]["portrait_chips"], r.json()["board"]["display"]["safe_margin"]) == ("drop", 2)
    r = client.put(f"{API}/notices/tv-defaults", json={"safe_margin": 4}, headers=as_user("omer"))
    assert r.status_code == 200 and r.json()["tv2_defaults"]["safe_margin"] == 4


def test_a_change_is_audited_and_an_unchanged_save_is_not(client):
    _enable(client)
    bid = _board(client)["board"]["id"]
    assert client.put(f"{API}/notices/tv-defaults", json={"safe_margin": 2, "portrait_chips": "drop"}).status_code == 200
    rows = _audit(client, "notices.tv_defaults.update")
    assert len(rows) == 1 and rows[0]["keys"] == ["notices.tv2.portrait_chips", "notices.tv2.safe_margin"]
    assert client.put(f"{API}/notices/tv-defaults", json={"safe_margin": 2}).status_code == 200  # the same value again: nothing changed
    assert len(_audit(client, "notices.tv_defaults.update")) == 1

    assert client.patch(f"{API}/notices/boards/{bid}", json={"display": {"safe_margin": 4}}).status_code == 200
    assert client.patch(f"{API}/notices/boards/{bid}", json={"display": {"safe_margin": None}}).status_code == 200
    assert client.patch(f"{API}/notices/boards/{bid}", json={"display": {"place": "A"}}).status_code == 200  # an unrelated change: no tv_fit entry
    rows = _audit(client, "notices.board.update")
    assert [r.get("tv_fit") for r in rows] == [{"safe_margin": 4}, {"safe_margin": None}, None]
