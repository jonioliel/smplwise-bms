"""TVNOTICE2-297: the owner's answers of 27.10 on the TV notice board.

- The screen header keeps the two-row header ("as before", c) as the installation default; the one-row header a / b stays a choice
  (installation default and per board).
- The "updated" line: both wordings are choices; the default is the approved preview wording ("place": updated · <place> <time>);
  the wording the product had ("full": updated <time> · <board name>) stays selectable, and an installation or a board that stored
  it keeps it.
- The idle board (no notice to show): the clock and the SmplWise logo by default ("sw"); "both" adds the developer logo.
No migration: the choices live in the settings rows `notices.tv.*` and in the board's display JSON."""
from __future__ import annotations

import pytest

from smplwise.services.notices import model

API = "/api/v1"


def _enable(client):
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200


def _board(client, slug="lobby", display=None):
    body = {"name": "לוח", "slug": slug, **({"display": display} if display is not None else {})}
    r = client.post(f"{API}/notices/boards", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _fd(client, slug, token):
    return client.get(f"{API}/notices/display/{slug}", headers={"X-Board-Token": token}).json()["board"]["display"]


def test_header_default_stays_as_before_and_both_one_row_headers_stay_choices():
    assert model.TV_FACTORY["header"] == "c"
    assert model.SETTINGS_DEFAULTS["notices.tv.header"] == "c"
    for h in ("a", "b"):
        assert model.tv_defaults_values({"header": h}) == {"notices.tv.header": h}
        assert model.normalize_display({"header": h}, strict=True)["header"] == h


def test_updated_line_default_is_the_preview_wording_and_the_old_wording_stays_a_choice():
    assert "place" in model.UPDATED_LINES and "full" in model.UPDATED_LINES
    assert model.TV_FACTORY["updated"] == "place"
    assert model.SETTINGS_DEFAULTS["notices.tv.updated"] == "place"
    # an installation that stored the old wording keeps it
    assert model.tv_defaults_doc(lambda k, d: {"notices.tv.updated": "full"}.get(k, d))["updated"] == "full"
    assert model.tv_defaults_values({"updated": "place"}) == {"notices.tv.updated": "place"}


@pytest.mark.parametrize("bad", ["", "Place", "both", 1, True, None])
def test_idle_logo_values_are_validated(bad):
    assert model.TV_FACTORY["idle_logo"] == "sw" and model.SETTINGS_DEFAULTS["notices.tv.idle_logo"] == "sw"
    if bad is None:
        assert "idle_logo" not in model.normalize_display({"idle_logo": None}, strict=True)
        return
    if bad == "both":
        assert model.normalize_display({"idle_logo": "both"}, strict=True)["idle_logo"] == "both"
        return
    with pytest.raises(model.Invalid) as e:
        model.normalize_display({"idle_logo": bad}, strict=True)
    assert e.value.field == "display.idle_logo"
    with pytest.raises(model.Invalid):
        model.tv_defaults_values({"idle_logo": bad})


def test_the_feed_carries_the_new_defaults_and_the_choices(client):
    _enable(client)
    b = _board(client)
    d = _fd(client, "lobby", b["token"])
    assert (d["header"], d["updated"], d["idle_logo"]) == ("c", "place", "sw")
    # the installation default changes every board without its own value
    r = client.put(f"{API}/notices/tv-defaults", json={"updated": "full", "idle_logo": "both"})
    assert r.status_code == 200 and (r.json()["tv_defaults"]["updated"], r.json()["tv_defaults"]["idle_logo"]) == ("full", "both")
    d = _fd(client, "lobby", b["token"])
    assert (d["updated"], d["idle_logo"]) == ("full", "both")
    # a board's own choice wins
    bid = b["board"]["id"]
    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"updated": "place", "idle_logo": "sw"}})
    assert r.status_code == 200
    d = _fd(client, "lobby", b["token"])
    assert (d["updated"], d["idle_logo"]) == ("place", "sw")
    assert client.patch(f"{API}/notices/boards/{bid}", json={"display": {"idle_logo": "dev"}}).status_code == 422
    assert client.put(f"{API}/notices/tv-defaults", json={"idle_logo": "dev"}).status_code == 422
