"""TVOPT-295: the four TV screen choices the owner asked for after the one-row header preview - the header (a / b / c), the
"updated" status line (full / time / issues), what the freed height goes to (bigger / more / mix) and the company logo on the dark
screen (auto / plate / invert). They live in the board's display JSON (no migration), are validated like the other screen settings,
reach the TV feed and the Settings preview, and are edited under the same permission (notices.boards)."""
from __future__ import annotations

import pytest

from conftest import as_user, bind  # noqa: F401
from smplwise.services.notices import model

API = "/api/v1"
KEYS = ("header", "updated", "space", "night_logo")
ALLOWED = {"header": model.HEADERS, "updated": model.UPDATED_LINES, "space": model.SPACE_USES, "night_logo": model.NIGHT_LOGOS}
DEFAULTS = {"header": "c", "updated": "full", "space": "bigger", "night_logo": "auto"}


def _enable(client):
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200


def _board(client, slug="lobby"):
    r = client.post(f"{API}/notices/boards", json={"name": "לוח", "slug": slug})
    assert r.status_code == 200
    return r.json()


def _feed(client, slug, token):
    return client.get(f"{API}/notices/display/{slug}", headers={"X-Board-Token": token})


def test_defaults_are_the_screen_as_it_was():
    d = model.normalize_display({})
    assert {k: d[k] for k in KEYS} == DEFAULTS
    assert {k: model.DISPLAY_DEFAULTS[k] for k in KEYS} == DEFAULTS
    old = model.load_display('{"template": 3, "logos": "c", "saver": "off"}')  # a board stored before TVOPT-295
    assert {k: old[k] for k in KEYS} == DEFAULTS and (old["template"], old["logos"], old["saver"]) == (3, "c", "off")


def test_the_allowed_values():
    assert model.HEADERS == ("a", "b", "c")
    assert model.UPDATED_LINES == ("full", "time", "issues")
    assert model.SPACE_USES == ("bigger", "more", "mix")
    assert model.NIGHT_LOGOS == ("auto", "plate", "invert")
    for k, allowed in ALLOWED.items():
        for v in allowed:
            assert model.normalize_display({k: v})[k] == v
            assert model.normalize_display({k: v}, strict=True)[k] == v


@pytest.mark.parametrize("key", KEYS)
@pytest.mark.parametrize("bad", ["", "A", "d", "bigger ", 1, True, None, ["a"], {"v": "a"}])
def test_unknown_values_load_as_the_default_and_a_patch_refuses_them(key, bad):
    if bad in ALLOWED[key]:
        pytest.skip("an allowed value")
    assert model.normalize_display({key: bad})[key] == DEFAULTS[key]  # lenient on load
    with pytest.raises(model.Invalid) as e:
        model.normalize_display({key: bad}, strict=True)
    assert e.value.field == f"display.{key}"


def test_merge_keeps_the_other_choices():
    cur = model.normalize_display({"header": "a", "updated": "time", "space": "mix", "night_logo": "invert", "logos": "b"})
    m = model.merge_display(cur, {"header": "b"})
    assert (m["header"], m["updated"], m["space"], m["night_logo"], m["logos"]) == ("b", "time", "mix", "invert", "b")


def test_stored_validated_and_carried_to_the_feed_and_the_preview(client):
    _enable(client)
    made = _board(client)
    bid, token = made["board"]["id"], made["token"]
    assert {k: made["board"]["display"][k] for k in KEYS} == DEFAULTS
    for bad in ({"header": "d"}, {"updated": "never"}, {"space": 2}, {"night_logo": "white"}, {"header": None}):
        assert client.patch(f"{API}/notices/boards/{bid}", json={"display": bad}).status_code == 422, bad
    want = {"header": "a", "updated": "issues", "space": "more", "night_logo": "plate"}
    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": want})
    assert r.status_code == 200 and {k: r.json()["board"]["display"][k] for k in KEYS} == want
    feed = _feed(client, "lobby", token)
    assert feed.status_code == 200 and {k: feed.json()["board"]["display"][k] for k in KEYS} == want
    # a choice changes the feed's version, so a TV polling with If-None-Match redraws
    v1 = feed.json()["board"]["version"]
    assert client.patch(f"{API}/notices/boards/{bid}", json={"display": {"header": "b"}}).status_code == 200
    assert _feed(client, "lobby", token).json()["board"]["version"] != v1
    # the preview takes a draft without saving it
    r = client.post(f"{API}/notices/boards/{bid}/preview", json={"display": {"header": "c", "space": "mix", "night_logo": "invert"}})
    assert r.status_code == 200
    d = r.json()["board"]["display"]
    assert (d["header"], d["space"], d["night_logo"]) == ("c", "mix", "invert")
    stored = client.get(f"{API}/notices/boards/{bid}").json()["board"]["display"]
    assert (stored["header"], stored["space"], stored["night_logo"]) == ("b", "more", "plate")
    # a board created with the choices keeps them
    r = client.post(f"{API}/notices/boards", json={"name": "לוח 2", "slug": "lobby-2", "display": {"header": "b", "updated": "time"}})
    assert r.status_code == 200 and (r.json()["board"]["display"]["header"], r.json()["board"]["display"]["updated"]) == ("b", "time")
    assert client.post(f"{API}/notices/boards", json={"name": "לוח 3", "slug": "lobby-3", "display": {"updated": "x"}}).status_code == 422


def test_only_the_screen_settings_permission_changes_them(client, settings):
    """The same permission as every other screen setting of a board (notices.boards, granted per role)."""
    _enable(client)
    bid = _board(client)["board"]["id"]
    bind(client, settings, "dana", "viewer", "installation", "*")
    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"header": "a"}}, headers=as_user("dana"))
    assert r.status_code == 403
    assert client.get(f"{API}/notices/boards/{bid}").json()["board"]["display"]["header"] == "c"
    bind(client, settings, "omer", "notices_boards", "installation", "*")
    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"header": "a", "night_logo": "invert"}}, headers=as_user("omer"))
    assert r.status_code == 200 and r.json()["board"]["display"]["header"] == "a"
