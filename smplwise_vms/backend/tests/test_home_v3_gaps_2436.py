"""HOME-V3-GAPS-2436: the server side of the home interface v3 mockup's remaining gaps - `GET /home/alarm-log`, the alarm's arm /
disarm changes for the home diary's "אזעקה" filter.

* only actions the panel confirmed, only alarm actions, only the last 7 days, newest first, the actor's name and whether it was me;
* only panels the caller may view (the alarm router's own reach rule): no alarm.view -> 403; a floor scope without the panel placed
  there -> nothing;
* a home-only person whose administrator hid the house log or the alarm category -> 403 `home_module_off`;
* never an argument, a code or a request id in the answer.
Time-independent: every stamp is relative to the real clock at test time."""
from __future__ import annotations

import datetime as dt
import json
import uuid
from dataclasses import replace

import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.services import home_interface as hi

PANEL = "alarm_control_panel.house"


@pytest.fixture()
def client(settings):
    hi.reset_state_for_tests()
    from smplwise.main import create_app

    a = create_app(replace(settings))
    c = TestClient(a)
    assert c.get("/api/v1/me").status_code == 200  # joni: the bootstrap system administrator
    yield c, a, settings
    hi.reset_state_for_tests()


def _ago(**kw) -> str:
    return (dt.datetime.now(dt.timezone.utc) - dt.timedelta(**kw)).strftime("%Y-%m-%dT%H:%M:%SZ")


def _action(app, user: str, action_id: str, status: str = "confirmed", entity: str = PANEL, **ago) -> None:
    at = _ago(**(ago or {"hours": 1}))
    with app.state.db.connection() as conn:
        conn.execute(
            "INSERT INTO ha_actions(id, entity_id, action_id, arguments_json, principal_user_id, principal_username, client_request_id, status, requested_at, confirmed_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            (uuid.uuid4().hex, entity, action_id, json.dumps({"code": "1234"}), f"dev-{user}", user, uuid.uuid4().hex, status, at, at if status == "confirmed" else None),
        )


def _seed(c, app, s):
    for u in ("dana", "rami"):
        bind(c, s, u, "operator", "installation", "*")
    with app.state.db.connection() as conn:
        conn.execute("UPDATE users SET display_name = 'דנה' WHERE id = 'dev-dana'")
    _action(app, "dana", "alarm_control_panel.alarm_arm_home", hours=1)
    _action(app, "rami", "alarm_control_panel.alarm_disarm", hours=30)
    _action(app, "dana", "alarm_control_panel.alarm_arm_away", minutes=5)
    _action(app, "dana", "alarm_control_panel.alarm_arm_night", status="failed", minutes=3)  # never confirmed: not listed
    _action(app, "dana", "alarm_control_panel.alarm_arm_away", days=8)  # older than 7 days: not listed
    _action(app, "dana", "light.turn_on", entity="light.kitchen", minutes=2)  # not an alarm action
    _action(app, "dana", "alarm_control_panel.alarm_trigger", minutes=1)  # not an offered alarm action


def test_alarm_log_lists_confirmed_alarm_changes_of_the_last_week_newest_first(client):
    c, app, s = client
    _seed(c, app, s)
    r = c.get("/api/v1/home/alarm-log", headers=as_user("dana"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["days"] == 7
    items = body["items"]
    assert [i["action"] for i in items] == ["arm_away", "arm_home", "disarm"]
    assert [i["panel"] for i in items] == [PANEL] * 3
    assert items[0]["by"] == "דנה" and items[0]["me"] is True
    assert items[2]["by"] == "rami" and items[2]["me"] is False
    stamps = [dt.datetime.fromisoformat(i["at"].replace("Z", "+00:00")) for i in items]
    assert stamps == sorted(stamps, reverse=True)
    # only when, which panel, which change, who - never the arguments (a code) or a request id
    assert all(set(i) == {"at", "panel", "action", "by", "me"} for i in items)
    assert "1234" not in r.text


def test_alarm_log_needs_alarm_view_and_follows_the_panels_reach(client):
    c, app, s = client
    _seed(c, app, s)
    # no binding at all: no alarm.view anywhere -> the audited 403
    c.get("/api/v1/me", headers=as_user("nobody"))
    r = c.get("/api/v1/home/alarm-log", headers=as_user("nobody"))
    assert r.status_code == 403
    # a kiosk role holds no alarm.view
    bind(c, s, "kira", "kiosk", "installation", "*")
    assert c.get("/api/v1/home/alarm-log", headers=as_user("kira")).status_code == 403
    # a floor scope where the panel is not placed: the panel is out of reach, nothing listed
    bind(c, s, "fay", "operator", "floor", seed_tree(c)["floor2"])
    r = c.get("/api/v1/home/alarm-log", headers=as_user("fay"))
    assert r.status_code == 200 and r.json()["items"] == []


def test_alarm_log_respects_the_home_categories_of_a_home_only_person(client):
    c, app, s = client
    _seed(c, app, s)
    h = as_user("dana")
    assert c.put("/api/v1/home/policies/dev-dana", json={"home_only": True}).status_code == 200
    # under /home/: reachable by a home-only person; no list = every category
    assert c.get("/api/v1/home/alarm-log", headers=h).status_code == 200
    for mods in (["lights", "security"], ["lights", "log"]):
        assert c.put("/api/v1/home/policies/dev-dana", json={"modules": mods}).status_code == 200
        r = c.get("/api/v1/home/alarm-log", headers=h)
        assert r.status_code == 403 and r.json().get("code") == "home_module_off", mods
    assert c.put("/api/v1/home/policies/dev-dana", json={"modules": ["lights", "log", "security"]}).status_code == 200
    assert len(c.get("/api/v1/home/alarm-log", headers=h).json()["items"]) == 3
    # read only: no write method on the route
    assert c.post("/api/v1/home/alarm-log", headers=h, json={}).status_code == 405
