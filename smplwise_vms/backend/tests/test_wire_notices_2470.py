"""CR-RESPONSE-MODELS-C-2470: the notice board routes no existing test called successfully, through the wire oracle.

`GET /notices/boards/{id}/preview` (the Settings preview of a board's SAVED display - the TV's own payload through the session) was only
named by its POST twin's tests. Its happy path goes through the wire oracle (tests/support/wire_oracle.py, SW_WIRE_STRICT=1 from conftest):
the modelled answer must equal the route's own pre-model serialisation key for key and type for type; `compared` proves the answer of THIS
test was compared."""
from __future__ import annotations

from conftest import as_user, bind

from support import wire_oracle

API = "/api/v1"
ROUTE = "GET /api/v1/notices/boards/{board_id}/preview"


def _on(client) -> None:
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200


def _board(client, slug: str = "lobby") -> str:
    r = client.post(f"{API}/notices/boards", json={"name": "לוח " + slug, "slug": slug})
    assert r.status_code == 200, r.text
    return r.json()["board"]["id"]


def _denied(client, action: str) -> int:
    with client.app.state.db.connection() as conn:
        return conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = ? AND decision = 'denied'", (action,)).fetchone()[0]


def test_the_saved_preview_answers_the_tv_payload_through_the_oracle(client, settings):
    _on(client)
    bid = _board(client)
    nid = client.post(f"{API}/notices", json={"title": "מים כבויים מחר", "publish": True, "boards": [bid]}).json()["notice"]["id"]
    before = wire_oracle.CHECKED.get(ROUTE, 0)
    r = client.get(f"{API}/notices/boards/{bid}/preview")
    assert r.status_code == 200, r.text
    assert wire_oracle.CHECKED.get(ROUTE, 0) == before + 1  # this answer was compared with the route's own dict
    doc = r.json()
    assert doc["board"]["slug"] == "lobby" and [n["id"] for n in doc["notices"]] == [nid]
    # the saved display: the same payload as the POST preview without a draft (`now` is the request's own instant)
    post = client.post(f"{API}/notices/boards/{bid}/preview", json={}).json()
    assert {k: v for k, v in doc.items() if k != "now"} == {k: v for k, v in post.items() if k != "now"}


def test_the_saved_preview_needs_notices_boards_and_a_live_board(client, settings):
    _on(client)
    bid = _board(client)
    bind(client, settings, "dana", "viewer", "installation", "*")
    denied = _denied(client, "notices.boards")
    r = client.get(f"{API}/notices/boards/{bid}/preview", headers=as_user("dana"))
    assert r.status_code == 403
    assert _denied(client, "notices.boards") == denied + 1  # the audited refusal
    assert client.get(f"{API}/notices/boards/nope/preview").status_code == 404
    assert client.delete(f"{API}/notices/boards/{bid}").status_code == 200
    assert client.get(f"{API}/notices/boards/{bid}/preview").status_code == 404
