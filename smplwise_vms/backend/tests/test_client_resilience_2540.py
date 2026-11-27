"""CLIENT-RESILIENCE-2540 (deep review 2520, frontend core FC-06): the first frame of every `/me/ws` connection names the add-on version
that answers, beside the permissions fingerprint (additive). The socket reconnects on every add-on restart, an update included, so a page
left open across an update compares it with its own bundle (`__ARX_BUILD__`) and offers a reload. The version is the one /health already
gives every signed-in caller; nothing else is added."""
from __future__ import annotations

import pytest
from conftest import as_user
from notify_world import API, World, fake_push  # noqa: F401 - fixture

from smplwise import __version__


@pytest.fixture()
def w(settings, fake_push) -> World:  # noqa: F811 - the imported pytest fixture, requested by name (no real push service)
    return World(settings)


def test_me_ws_hello_names_the_running_version(w):
    with w.c.websocket_connect(f"{API}/me/ws", headers=as_user("ops2")) as ws:
        hello = ws.receive_json()
    assert hello["type"] == "hello"
    payload = hello["payload"]
    assert payload["build"] == __version__
    # additive: what the shell read before is all still there
    assert {"permissions_fingerprint", "permission_revision", "active"} <= set(payload)
    assert set(payload) == {"permissions_fingerprint", "permission_revision", "active", "build"}
