"""FIX-SERVER-CLOCK-2560 (deep review 2.56, out-of-area note to VD-01 / FE-04): every route that takes a client `expires_at` refuses
both an expired stamp and one too far ahead. `POST /ha/entities/{id}/actions` (every entity action, the WisKey door tile through
`open_from_tile`) checked only "not expired": a stamp hours ahead (a device clock fast by hours, a body replayed later) stayed valid
for ever. Now: at most 5 min ahead (the alarm route's bound), else 422 `expires_too_far`, nothing sent, the door tile's refusal audited."""
from __future__ import annotations

import datetime as _dt
import uuid
from typing import Any

from conftest import as_user, bind
from test_ha_authority import _body, paired  # noqa: F401 - the fixture
from test_wiskey_door_path import API, _clean, map_all, rows, world  # noqa: F401 - the fixtures (_clean: autouse)

from smplwise.routers import access_control_door, ha as ha_router
from support.waiting import soon


def _at(seconds: float) -> str:
    return (_dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(seconds=seconds)).strftime("%Y-%m-%dT%H:%M:%SZ")


def test_bounds_are_the_alarm_routes_five_minutes():
    assert ha_router.EXPIRY_MAX_S == 300.0
    assert access_control_door.TILE_EXPIRY_MAX_S == 300.0


def test_entity_action_refuses_an_expiry_too_far_ahead_and_sends_nothing(paired):  # noqa: F811 - the imported fixture
    _app, _s, c, calls, _answers, _ids = paired
    for i, ahead in enumerate((10 * 60, 24 * 3600, 365 * 86400)):  # 10 min, a day, the "2099" class
        r = c.post("/api/v1/ha/entities/light.lobby/actions", json=_body(client_request_id=f"far-{i}", expires_at=_at(ahead)))
        assert r.status_code == 422, r.text
        assert r.json()["code"] == "expires_too_far"
    assert calls == [], "a refused envelope never reaches the bridge"
    # expired: still 409 `expired`
    r = c.post("/api/v1/ha/entities/light.lobby/actions", json=_body(client_request_id="past", expires_at=_at(-5)))
    assert r.status_code == 409 and r.json()["code"] == "expired", r.text
    assert calls == []
    # inside the bound: accepted (the client's 60 s, and 4 min for a server-clock sample a little off)
    for i, ahead in enumerate((60, 240)):
        r = c.post("/api/v1/ha/entities/light.lobby/actions", json=_body(client_request_id=f"ok-{i}", expires_at=_at(ahead)))
        assert r.status_code == 202, r.text
    assert len(calls) == 2


def test_door_tile_refuses_an_expiry_too_far_ahead_audited_nothing_sent(world):  # noqa: F811 - the imported fixture
    c, db, s, feed = world["c"], world["db"], world["settings"], world["feed"]
    map_all(c)
    bind(c, s, "dana", "door_opener", "installation", "*")

    def tile(expires_at: str) -> Any:
        body = {"allowed_action_id": "lock.unlock", "client_request_id": str(uuid.uuid4()), "expires_at": expires_at, "confirmation_grant": "confirmed"}
        return c.post(f"{API}/ha/entities/lock.entrance/actions", json=body, headers=as_user("dana"))

    r = tile(_at(10 * 60))
    assert r.status_code == 422 and r.json()["code"] == "expires_too_far", r.text
    r = tile(_at(-5))
    assert r.status_code == 409 and r.json()["code"] == "expired", r.text
    assert feed.sent == [], "nothing reached the station"
    refused = [x["reason"] for x in rows(db, "intercom.release") if x["details"].get("phase") == "refused"]
    assert refused == ["expires_too_far", "expired"], refused
    r = tile(soon())
    assert r.status_code == 202, r.text
    assert len(feed.sent) == 1
