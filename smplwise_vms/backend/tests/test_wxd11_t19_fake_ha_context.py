"""WXD11 gate row T19, the fake-HA part (DOOR-BRIDGE-BLOCK-2404): Arx-started runs of converted items (CR-033 R-17) against a fake Home
Assistant that models `Context` - `user_id` / `parent_id`, concurrent runs and a permission change in the middle of a run (DR-8 gate).

The fake (tests/fake_ha_config.py, `model_context = True`) follows Home Assistant's own rules: a script run takes the calling context as
it is (same id, same user_id) and hands it on to a nested `script.turn_on`; an automation's `trigger` starts a NEW context whose
`parent_id` is the caller's context id and whose `user_id` is None. The runs go through the REAL bridge `config_item` code; the doors
through the one door path on the fake WisKey feed. No Home Assistant, bridge, WisKey, door or key.

What T19 proves here:
- no door step of a converted run ever reaches Home Assistant, in any context (so a WisKey lock entity that checks `context.user_id`
  - DR-7 - is never asked), and the person is carried by Arx's door path, not by Home Assistant's context: an automation's HA context
  has lost the user (only `parent_id` links it), yet every door attempt names the operator;
- two operators' runs at the same time keep their own HA context, their own doors, their own request ids;
- a door permission revoked while a run is opening its doors stops the next door before anything is sent for it."""
from __future__ import annotations

import json
import threading
import uuid
from typing import Any

from automations_fixture import autos_app, grant  # noqa: F401  (the CR-017 fixture)
from conftest import as_user, bind
from test_wiskey_door_inventory import DOCK, ENTRY, FakeConversions, _clean, _runs, autos  # noqa: F401  (fixtures)

from smplwise.db import bump_permission_revision, now_iso
from smplwise.services import automations, door_run_guard

API = "/api/v1"


def _rid() -> str:
    return f"t19-{uuid.uuid4().hex[:12]}"


def _attempts(db: Any) -> list[dict[str, Any]]:
    with db.connection(mode="read") as conn:
        return [json.loads(r[0]) | {"actor": r[1]} for r in conn.execute(
            "SELECT details_json, actor_user_id FROM audit_log WHERE action = 'intercom.release' ORDER BY id").fetchall()]


def _model(autos: dict[str, Any]) -> Any:
    fake = autos["fake"]
    fake.model_context = True
    return fake


def _seed(autos: dict[str, Any]) -> None:
    from automations_transport import seed_mirror

    seed_mirror(autos["app"].state.db, autos["fake"])
    automations.MIRROR.pull(None, "test")


def _lock_steps(fake: Any) -> list[dict[str, Any]]:
    return [s for s in fake.step_calls if s["action"].startswith("lock.") or any(str(e).startswith("lock.") for e in s["entity_ids"])]


def test_t19_ha_context_carries_the_caller_the_door_path_carries_the_person(autos):
    c, app, feed, fake = autos["c"], autos["app"], autos["feed"], _model(autos)
    fake.scripts["conv_outer"] = {"alias": "חיצוני שהוסב", "sequence": [{"parallel": [{"action": "script.turn_on", "target": {"entity_id": "script.conv_script"}}]}]}
    fake._seed_script_entity("conv_outer", fake.scripts["conv_outer"])
    auto = {"id": "8002", "alias": "אוטומציה שהוסבה", "mode": "single", "triggers": [{"trigger": "time", "at": "07:00:00"}], "conditions": [],
            "actions": [{"action": "light.turn_on", "target": {"entity_id": "light.office"}}]}
    fake._seed_automation("automation.conv_auto", "8002", auto, True)
    _seed(autos)
    door_run_guard.set_conversion_source(FakeConversions({("script", "conv_outer"): [door_run_guard.ConvertedDoor(ENTRY, 1, "lock.entrance")],
                                                          ("automation", "8002"): [door_run_guard.ConvertedDoor(DOCK, 2)]}))
    r = c.post(f"{API}/automations/script/conv_outer/run", json={"client_request_id": _rid(), "confirm": True})
    assert r.status_code == 202 and [d["outcome"] for d in r.json()["doors"]] == ["sent"], r.text
    r = c.post(f"{API}/automations/automation/8002/run", json={"client_request_id": _rid(), "confirm": True})
    assert r.status_code == 202 and [d["outcome"] for d in r.json()["doors"]] == ["sent"], r.text
    calls = [x for x in fake.bridge_hass().calls if x["service"] in ("turn_on", "trigger") and x["domain"] in ("script", "automation")]
    (script_call, auto_call) = calls
    assert script_call["context"].user_id == "dev-joni" and auto_call["context"].user_id == "dev-joni", "the bridge calls as the operator"
    outer = fake.traces[("script", "conv_outer")][-1]["context"]
    inner = fake.traces[("script", "conv_script")][-1]["context"]
    assert outer == {"id": script_call["context"].id, "parent_id": None, "user_id": "dev-joni"}
    assert inner == outer, "a nested script runs in the same context (Home Assistant hands it on)"
    auto_ctx = fake.traces[("automation", "8002")][-1]["context"]
    assert auto_ctx["parent_id"] == auto_call["context"].id and auto_ctx["user_id"] is None, "an automation run has lost the user in Home Assistant"
    assert _lock_steps(fake) == [], "no door step reached Home Assistant in any context"
    assert autos["executed"] == [] and len(feed.sent) == 2
    attempts = [a for a in _attempts(app.state.db) if a.get("phase") == "attempt"]
    assert [(a["actor"], a["origin"], a["entry_point"]) for a in attempts] == [("dev-joni", "script:conv_outer", "run"), ("dev-joni", "automation:8002", "run")], \
        "the person is named by the door path even where the HA context is anonymous"


def test_t19_an_unconverted_door_item_never_runs_so_ha_sees_no_context_at_all(autos):
    c, fake = autos["c"], _model(autos)
    before = len(fake.bridge_hass().calls) if getattr(fake, "_bridge", None) is not None else 0
    for path in ("script/door_script/run", "script/outer_script/run", "automation/8001/run"):
        r = c.post(f"{API}/automations/{path}", json={"client_request_id": _rid(), "confirm": True})
        assert r.status_code == 409 and r.json()["code"] == "door_step_not_converted", (path, r.text)
    after = len(fake.bridge_hass().calls) if getattr(fake, "_bridge", None) is not None else 0
    assert after == before and fake.step_calls == [] and autos["feed"].sent == [] and _runs(autos["tr"]) == []


def test_t19_concurrent_runs_keep_their_own_context_doors_and_request_ids(autos):
    c, s, app, feed, fake = autos["c"], autos["s"], autos["app"], autos["feed"], _model(autos)
    grant(c, "omer", "מריץ סקריפטים", ["script.run", "devices.read", "devices.control"], [], "installation", "*")
    bind(c, s, "omer", "door_opener", "installation", "*")
    door_run_guard.set_conversion_source(FakeConversions({("script", "conv_script"): [door_run_guard.ConvertedDoor(ENTRY, 1, "lock.entrance")],
                                                          ("script", "conv_other"): [door_run_guard.ConvertedDoor(DOCK, 1), door_run_guard.ConvertedDoor(DOCK, 2)]}))
    # Home Assistant handles one service call at a time on its event loop; the fake's YAML file layer is not thread-safe, so its side
    # is serialized the same way. The two Arx requests themselves run at the same time.
    ha_lock = threading.Lock()
    real_bridge = autos["tr"].bridge

    def one_at_a_time(payload: dict[str, Any]) -> dict[str, Any]:
        with ha_lock:
            return real_bridge(payload)

    autos["tr"].bridge = one_at_a_time
    start = threading.Barrier(2, timeout=10)
    out: dict[str, Any] = {}

    def run(name: str, item: str, user: str) -> None:
        try:
            start.wait()
            out[name] = c.post(f"{API}/automations/script/{item}/run", json={"client_request_id": _rid(), "confirm": True}, headers=as_user(user))
        except BaseException as exc:  # noqa: BLE001 - reported by the assertion below, not lost in the thread
            out[name] = exc

    threads = [threading.Thread(target=run, args=("joni", "conv_script", "joni")), threading.Thread(target=run, args=("omer", "conv_other", "omer"))]
    for t in threads:
        t.start()
    for t in threads:
        t.join(30)
    assert not any(isinstance(v, BaseException) for v in out.values()) and set(out) == {"joni", "omer"}, out
    assert out["joni"].status_code == 202 and out["omer"].status_code == 202, (out["joni"].text, out["omer"].text)
    assert [d["outcome"] for d in out["joni"].json()["doors"]] == ["sent"] and [d["outcome"] for d in out["omer"].json()["doors"]] == ["sent", "sent"]
    assert sorted(_runs(autos["tr"])) == ["run_script", "run_script"], "one Home Assistant run per request"
    assert fake.traces[("script", "conv_script")][-1]["context"]["user_id"] == "dev-joni"
    assert fake.traces[("script", "conv_other")][-1]["context"]["user_id"] == "dev-omer"
    assert fake.traces[("script", "conv_script")][-1]["context"]["id"] != fake.traces[("script", "conv_other")][-1]["context"]["id"]
    assert _lock_steps(fake) == [] and autos["executed"] == []
    rows = _attempts(app.state.db)
    attempts = [a for a in rows if a.get("phase") == "attempt"]
    by_actor = sorted((a["actor"], a["origin"], a["lock"]) for a in attempts)
    assert by_actor == [("dev-joni", "script:conv_script", 1), ("dev-omer", "script:conv_other", 1), ("dev-omer", "script:conv_other", 2)]
    ids = [a["door_request_id"] for a in attempts]
    assert len(set(ids)) == 3 and {a["door_request_id"] for a in rows if a.get("phase") == "outcome"} == set(ids)
    assert len({a["run_op_id"] for a in attempts if a["actor"] == "dev-omer"}) == 1 and len({a["run_op_id"] for a in attempts}) == 2
    assert sorted((x["who"], x["frames"][0]["lock"]) for x in feed.sent) == sorted([("dev-joni", 1), ("dev-omer", 1), ("dev-omer", 2)])


def test_t19_a_permission_revoked_mid_run_stops_the_next_door_before_it_is_sent(autos, monkeypatch):
    c, s, app, feed, fake = autos["c"], autos["s"], autos["app"], autos["feed"], _model(autos)
    grant(c, "omer", "מריץ סקריפטים", ["script.run", "devices.read", "devices.control"], [], "installation", "*")
    bind(c, s, "omer", "door_opener", "installation", "*")
    door_run_guard.set_conversion_source(FakeConversions({("script", "conv_script"): [door_run_guard.ConvertedDoor(ENTRY, 1, "lock.entrance"),
                                                                                       door_run_guard.ConvertedDoor(DOCK, 2)]}))
    real = feed.action
    revoked: list[str] = []

    def action(*a: Any, **k: Any) -> Any:
        result = real(*a, **k)
        if not revoked:
            # the administrator takes the door permission away while the first door is being opened (another request; the run holds
            # no write lock while a door command is out)
            with app.state.db.write_aside(label="t19 revoke") as w:
                w.execute("UPDATE bindings SET revoked_at = ? WHERE subject_kind = 'user' AND subject_id = 'dev-omer' AND role_id = 'door_opener' AND revoked_at IS NULL",
                          (now_iso(),))
                bump_permission_revision(w)
            revoked.append("door_opener")
        return result

    import smplwise.services.intercom_sync as intercom_sync

    monkeypatch.setattr(intercom_sync.SYNC, "action", action)
    r = c.post(f"{API}/automations/script/conv_script/run", json={"client_request_id": _rid(), "confirm": True}, headers=as_user("omer"))
    assert r.status_code == 202, r.text
    doors = r.json()["doors"]
    assert [d["outcome"] for d in doors] == ["sent", "not_sent"] and doors[1]["message"] == "אין הרשאה לפתוח דלת זו", doors
    assert revoked == ["door_opener"] and len(feed.sent) == 1 and feed.sent[0]["who"] == "dev-omer"
    assert _runs(autos["tr"]) == ["run_script"] and _lock_steps(fake) == [] and autos["executed"] == []
    with app.state.db.connection(mode="read") as conn:
        denied = conn.execute("SELECT actor_user_id, reason FROM audit_log WHERE action = 'intercom.release' AND decision = 'denied'").fetchall()
    assert [(d[0], d[1]) for d in denied] == [("dev-omer", "forbidden")], "the refused door is audited with the operator"
    # the next run is refused as a whole before anything runs
    r = c.post(f"{API}/automations/script/conv_script/run", json={"client_request_id": _rid(), "confirm": True}, headers=as_user("omer"))
    assert r.status_code == 403 and _runs(autos["tr"]) == ["run_script"] and len(feed.sent) == 1
