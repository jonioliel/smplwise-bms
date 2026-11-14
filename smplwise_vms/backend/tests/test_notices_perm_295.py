"""NOTICEPERM-295: the permanent TV link (the token is also stored sealed; an administrator reads the SAME link again), the wash saver as
the default, and the board setting that hides the building-status chips altogether."""
from __future__ import annotations

import json

from conftest import as_user, bind  # noqa: F401
from smplwise.db import Database
from smplwise.services.notices import model

API = "/api/v1"


def _enable(client):
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200


def _board(client, slug="lobby"):
    r = client.post(f"{API}/notices/boards", json={"name": "לוח", "slug": slug})
    assert r.status_code == 200
    return r.json()


def test_stored_link_is_the_same_every_time(client, settings):
    _enable(client)
    made = _board(client)
    bid, token = made["board"]["id"], made["token"]
    assert made["board"]["has_stored_link"] is True
    first = client.get(f"{API}/notices/boards/{bid}/link")
    again = client.get(f"{API}/notices/boards/{bid}/link")
    assert first.status_code == 200 and again.status_code == 200
    assert first.json()["token"] == token == again.json()["token"]
    assert first.headers.get("cache-control") == "no-store"
    # the TV feed still works with it
    assert client.get(f"{API}/notices/display/lobby", headers={"X-Board-Token": token}).status_code == 200


def test_token_is_sealed_at_rest_and_never_in_the_board_payload(client, settings):
    _enable(client)
    made = _board(client)
    bid, token = made["board"]["id"], made["token"]
    with Database(settings.db_path).connection() as c:
        row = c.execute("SELECT token_hash, token_sealed FROM notice_boards WHERE id = ?", (bid,)).fetchone()
    assert row["token_sealed"] and token not in row["token_sealed"] and row["token_sealed"].startswith("v1:")
    blob = json.dumps(client.get(f"{API}/notices/boards/{bid}").json()) + json.dumps(client.get(f"{API}/notices/boards").json())
    assert token not in blob and row["token_sealed"] not in blob


def test_rotate_replaces_the_stored_link(client):
    _enable(client)
    made = _board(client)
    bid, old = made["board"]["id"], made["token"]
    new = client.post(f"{API}/notices/boards/{bid}/rotate-token").json()["token"]
    assert new != old
    assert client.get(f"{API}/notices/boards/{bid}/link").json()["token"] == new
    assert client.get(f"{API}/notices/display/lobby", headers={"X-Board-Token": old}).status_code in (401, 403, 404)


def test_board_saved_before_the_migration_issues_its_link_once(client, settings):
    _enable(client)
    made = _board(client)
    bid, old = made["board"]["id"], made["token"]
    with Database(settings.db_path).connection() as c:
        c.execute("UPDATE notice_boards SET token_sealed = NULL WHERE id = ?", (bid,))  # what a pre-0173 board looks like
    assert client.get(f"{API}/notices/boards/{bid}").json()["board"]["has_stored_link"] is False
    miss = client.get(f"{API}/notices/boards/{bid}/link")
    assert miss.status_code == 409 and miss.json()["code"] == "no_stored_link"
    issued = client.post(f"{API}/notices/boards/{bid}/issue-link")
    assert issued.status_code == 200 and issued.json()["token"] != old and issued.json()["board"]["has_stored_link"] is True
    assert client.get(f"{API}/notices/boards/{bid}/link").json()["token"] == issued.json()["token"]
    twice = client.post(f"{API}/notices/boards/{bid}/issue-link")  # once only: the next call never re-issues
    assert twice.status_code == 409 and twice.json()["code"] == "link_exists"
    assert client.get(f"{API}/notices/boards/{bid}/link").json()["token"] == issued.json()["token"]


def test_a_sealed_token_does_not_open_for_another_board(client, settings):
    _enable(client)
    a, b = _board(client, "a-board"), _board(client, "b-board")
    with Database(settings.db_path).connection() as c:
        sealed = c.execute("SELECT token_sealed FROM notice_boards WHERE id = ?", (a["board"]["id"],)).fetchone()["token_sealed"]
        c.execute("UPDATE notice_boards SET token_sealed = ? WHERE id = ?", (sealed, b["board"]["id"]))
    r = client.get(f"{API}/notices/boards/{b['board']['id']}/link")
    assert r.status_code == 409 and r.json()["code"] == "no_stored_link"


def test_link_needs_the_boards_permission(client, settings):
    _enable(client)
    bid = _board(client)["board"]["id"]
    H = as_user("dana")
    assert client.get(f"{API}/notices/boards/{bid}/link", headers=H).status_code == 403
    assert client.post(f"{API}/notices/boards/{bid}/issue-link", headers=H).status_code == 403


def test_saver_defaults_to_wash_for_new_and_never_chosen_boards():
    assert model.default_display()["saver"] == "wash"
    assert model.load_display("{}")["saver"] == "wash"
    assert model.load_display('{"saver": "ambient"}')["saver"] == "ambient"  # an explicit choice is kept
    assert model.load_display('{"saver": "off"}')["saver"] == "off"


def test_chips_can_be_hidden_altogether(client, settings):
    _enable(client)
    made = _board(client)
    token, bid = made["token"], made["board"]["id"]
    assert made["board"]["display"]["blocks"]["info_show"] is True  # the default is unchanged: shown
    feed = lambda: client.get(f"{API}/notices/display/lobby", headers={"X-Board-Token": token}).json()  # noqa: E731
    from smplwise.services.notices import info

    seen = []
    orig = info.build
    info.build = lambda conn, kinds, *a, **k: seen.append(list(kinds)) or []  # type: ignore[assignment]
    try:
        feed()
        client.patch(f"{API}/notices/boards/{bid}", json={"display": {"blocks": {"info_show": False}}})
        feed()
    finally:
        info.build = orig
    assert seen[0] == list(model.INFO_KINDS) and seen[1] == []  # hidden: nothing is even asked for
    kept = client.get(f"{API}/notices/boards/{bid}").json()["board"]["display"]["blocks"]
    assert kept["info_show"] is False and kept["info"] == list(model.INFO_KINDS)  # the picked kinds survive the switch
