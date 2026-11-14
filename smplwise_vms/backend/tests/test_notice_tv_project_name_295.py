"""NOTICEADD-295: the name the notice-board TV greets with (`board.building`: the welcome title, the template-3 header, the empty stage's
line "<name> · יום נעים", the footer). Order: the explicit notices setting (הגדרות › לוח הודעות › שם הבניין בלוחות), then the project
name of הגדרות › כללי › מראה המערכת (`brand.project.name` - 2.16.0 skipped it and showed the first site building's name), then the first
building, then the home title. A change moves the feed's version, so a polling TV redraws. Fakes only."""
from __future__ import annotations

from tests.conftest import seed_tree

API = "/api/v1"


def _board(client) -> str:
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200
    r = client.post(f"{API}/notices/boards", json={"name": "לוח הלובי", "slug": "lobby"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _feed(client, token) -> dict:
    r = client.get(f"{API}/notices/display/lobby", headers={"X-Board-Token": token})
    assert r.status_code == 200, r.text
    return r.json()


def _fallback(client) -> str:
    return client.get(f"{API}/notices/settings").json()["building_fallback"]


def test_the_project_name_outranks_the_first_building_and_the_version_moves(client):
    seed_tree(client)  # the first building is "מבנה א" (the lab's equivalent showed its site building's name)
    token = _board(client)
    doc = _feed(client, token)
    assert doc["board"]["building"] == "מבנה א"
    v1 = doc["board"]["version"]
    assert client.put(f"{API}/brand", json={"project_name": "מגדלי הים"}).status_code == 200
    doc2 = _feed(client, token)
    assert doc2["board"]["building"] == "מגדלי הים"
    assert doc2["board"]["version"] != v1, "a TV that polls the version redraws with the new name"
    assert _fallback(client) == "מגדלי הים"


def test_an_explicit_board_name_in_the_notice_settings_wins_and_the_placeholder_keeps_the_fallback(client):
    seed_tree(client)
    token = _board(client)
    assert client.put(f"{API}/brand", json={"project_name": "מגדלי הים"}).status_code == 200
    assert client.patch(f"{API}/notices/settings", json={"building_name": "בית הקהילה"}).status_code == 200
    assert _feed(client, token)["board"]["building"] == "בית הקהילה"
    assert _fallback(client) == "מגדלי הים", "the Settings field's placeholder names what an empty field would show"
    assert client.patch(f"{API}/notices/settings", json={"building_name": ""}).status_code == 200
    assert _feed(client, token)["board"]["building"] == "מגדלי הים"


def test_without_a_project_name_the_first_building_still_names_the_board(client):
    seed_tree(client)
    token = _board(client)
    assert client.put(f"{API}/brand", json={"project_name": "   "}).status_code in (200, 422)
    assert _feed(client, token)["board"]["building"] == "מבנה א"
