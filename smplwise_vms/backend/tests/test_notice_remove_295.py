"""NOTICEREMOVE-295: "הסרה מהלוח" on a board with archived notices on it (PUT /notices/boards/{id}/items). Fakes only."""
from __future__ import annotations

from conftest import as_user, bind  # noqa: F401  (conftest fixtures: client, settings)

API = "/api/v1"


def _setup(client):
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200
    b = client.post(f"{API}/notices/boards", json={"name": "לוח הלובי", "slug": "lobby"}).json()["board"]
    ids = []
    for t in ("ישנה", "חדשה", "נוספת"):
        r = client.post(f"{API}/notices", json={"title": t, "body": "x", "severity": "info", "publish": True, "boards": [b["id"]], "audience": {"everyone": True}})
        assert r.status_code == 200, r.text
        ids.append(r.json()["notice"]["id"])
    return b, ids


def _on_board(client, board_id):
    return [n["id"] for n in client.get(f"{API}/notices/boards/{board_id}").json()["notices"]]


def test_remove_from_board_works_while_an_archived_notice_is_on_the_board(client):
    b, (old, new, other) = _setup(client)
    assert client.post(f"{API}/notices/{old}/archive").status_code == 200
    assert old in _on_board(client, b["id"])  # archive keeps the link
    keep = [i for i in _on_board(client, b["id"]) if i != new]
    r = client.put(f"{API}/notices/boards/{b['id']}/items", json={"notice_ids": keep})
    assert r.status_code == 200, r.text
    assert new not in _on_board(client, b["id"])


def test_an_archived_notice_itself_can_be_removed_from_the_board(client):
    b, (old, new, other) = _setup(client)
    client.post(f"{API}/notices/{old}/archive")
    keep = [i for i in _on_board(client, b["id"]) if i != old]
    assert client.put(f"{API}/notices/boards/{b['id']}/items", json={"notice_ids": keep}).status_code == 200
    assert old not in _on_board(client, b["id"])


def test_a_new_archived_or_unknown_id_is_still_refused(client):
    b, (old, new, other) = _setup(client)
    client.post(f"{API}/notices/{other}/archive")
    client.put(f"{API}/notices/boards/{b['id']}/items", json={"notice_ids": [old]})
    r = client.put(f"{API}/notices/boards/{b['id']}/items", json={"notice_ids": [old, other]})
    assert r.status_code != 200
    assert client.put(f"{API}/notices/boards/{b['id']}/items", json={"notice_ids": [old, "nope"]}).status_code != 200
