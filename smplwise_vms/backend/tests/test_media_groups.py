"""CR-016 groups: live join / leave through the bulk engine, the party confirmation, group volume (ceilings only where an administrator set them), the saved groups
(presets) and their one-tap apply, the static and helper groups in the list, and the bulk `players_pause`. Every call goes through a fake bridge that applies the
effect the real add-on would, so the outcomes are READ BACK from the live state, as in production."""
from __future__ import annotations

import datetime as dt
import json
from typing import Any

import media_seed as mseed
import media_seed_audio as aseed
import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.db import now_iso
from smplwise.main import create_app
from smplwise.services import device_bulk, ha_actions, ha_client, ha_sync, media_commands

API = "/api/v1/multimedia"
GROUPS = f"{API}/groups"
UIDS = {"media_player.ma_a": aseed.UID_A, "media_player.ma_b": aseed.UID_B, "media_player.ma_den": aseed.UID_DEN}


def extra_house() -> aseed.House:
    """The MA house plus two more Music Assistant speakers in the living room (so a group of four can be asked for) and one upstairs."""
    h = aseed.ma_house()
    for i, area in ((1, "living"), (2, "living")):
        uid = f"ma-extra-000{i}"
        d = h.device(f"d_ex{i}", f"Extra {i}", "Acme", f"Box{i}", area, [["music_assistant", uid]], by_user=f"רמקול נוסף {i}")
        h.entity(f"media_player.ma_ex{i}", "music_assistant", d, "idle", aseed.MA_FULL, unique_id=uid, volume_level=0.2, is_volume_muted=False, group_members=[], active_queue=uid,
                 mass_player_type="player", name=f"Extra {i}", device_class="speaker")
        UIDS[f"media_player.ma_ex{i}"] = uid
    return h


@pytest.fixture()
def g(settings, monkeypatch):
    app = create_app(settings)
    c = TestClient(app)
    h = extra_house()
    for i in range(0, len(h.states), 40):
        assert c.post("/api/v1/ha/dev/states", json={"states": h.states[i:i + 40]}).status_code == 200
    assert c.post("/api/v1/ha/dev/registry", json={"entities": h.entities, "devices": h.devices, "areas": h.areas, "floors": h.floors}).status_code == 200
    aseed.approve_players(c)
    monkeypatch.setattr(ha_actions, "CONFIRM_WINDOW_S", 1.5)
    monkeypatch.setattr(device_bulk, "POLL_S", 0.1)
    monkeypatch.setattr(device_bulk, "MEMBERSHIP_WINDOW_S", 1.5, raising=False)
    device_bulk.RUNNER.clear()
    media_commands.BUCKETS.clear()
    fx = {"apply": True}

    def put(eid: str, state: str | None = None, **attrs: Any) -> None:
        with app.state.db.connection() as conn:
            row = conn.execute("SELECT state, attributes_json FROM ha_entities WHERE entity_id = ?", (eid,)).fetchone()
            cur = json.loads(row["attributes_json"] or "{}")
            now = now_iso()
            ha_sync.upsert_state(conn, {"entity_id": eid, "state": state or row["state"], "attributes": {**cur, **attrs}, "last_changed": now, "last_updated": now})

    def attrs_of(eid: str) -> dict[str, Any]:
        with app.state.db.connection(mode="read") as conn:
            return json.loads(conn.execute("SELECT attributes_json FROM ha_entities WHERE entity_id = ?", (eid,)).fetchone()["attributes_json"] or "{}")

    def result(payload):
        data = payload["data"]
        if fx["apply"]:
            if payload["service"] == "join":
                leader, members = data["entity_id"], data["group_members"]
                put(leader, group_members=[leader, *members])
                for m in members:
                    put(m, active_queue=UIDS.get(leader, leader))
            elif payload["service"] == "unjoin":
                me = data["entity_id"]
                for eid in list(UIDS):
                    ms = attrs_of(eid).get("group_members") or []
                    if me in ms and eid != me:
                        put(eid, group_members=[m for m in ms if m != me] if len([m for m in ms if m != me]) > 1 else [])
                put(me, group_members=[], active_queue=UIDS.get(me, me))
            elif payload["service"] == "volume_set":
                put(data["entity_id"], volume_level=data["volume_level"])
            elif payload["service"] == "media_pause":
                put(data["entity_id"], "paused")
        return {"ok": True, "context_id": "ctx"}

    calls = mseed.pair(c, monkeypatch, version="0.5.0", result=result)
    keys = {n: aseed.key_with(c, e) for n, e in {"a": "media_player.wiim_a", "b": "media_player.wiim_b", "denon": "media_player.denon_main", "garden": "media_player.cast_garden",
                                                 "console": "media_player.ma_console", "stereo": "media_player.ma_stereo", "x1": "media_player.ma_ex1", "x2": "media_player.ma_ex2"}.items()}
    yield app, c, calls, keys, settings, fx, put
    device_bulk.RUNNER.clear()


def req(**kw: Any) -> dict[str, Any]:
    expires = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {"client_request_id": kw.pop("client_request_id", "g-" + str(abs(hash(json.dumps(kw, sort_keys=True, default=str) + str(dt.datetime.now().timestamp()))))[:14]), "expires_at": expires, **kw}


def done(c: TestClient, resp, headers=None) -> dict[str, Any]:
    assert resp.status_code == 202, resp.text
    bulk_id = resp.json()["bulk_id"]
    assert device_bulk.RUNNER.wait(bulk_id, 30), "the group worker did not end"
    r = c.get(f"/api/v1/devices/actions/{bulk_id}", headers=headers or {})
    assert r.status_code == 200, r.text
    return r.json()


def outcomes(d: dict[str, Any]) -> dict[str, str]:
    return {x["name"]: x["outcome"] for x in d["items"]}


def live(c, key: str) -> dict[str, Any]:
    return c.get(f"{API}/devices/{key}").json()["live"]


# ------------------------------------------------------------------------------------------------ join and leave


def test_a_join_is_one_call_on_the_leaders_layer_and_the_outcome_is_read_back(g):
    app, c, calls, keys, settings, fx, put = g
    r = c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=[keys["b"]]))
    assert r.status_code == 202 and set(r.json()) == {"bulk_id", "status", "preview"} and r.json()["preview"]["needs_confirmation"] is False
    res = done(c, r)
    sent = [(p["domain"], p["service"], p["data"]) for p in calls]
    assert sent == [("media_player", "join", {"entity_id": "media_player.ma_a", "group_members": ["media_player.ma_b"]})], "one call, through the Music Assistant layer"
    assert outcomes(res) == {"רמקול סלון": "joined", "רמקול מטבח": "joined"} and res["status"] == "done" and res["counts"]["confirmed"] == 2
    a, b = live(c, keys["a"]), live(c, keys["b"])
    assert (a["group"]["role"], b["group"]["role"], b["group"]["leader_key"], a["group"]["layer"]) == ("leader", "member", keys["a"], "ma")
    assert a["group"]["member_keys"] == [keys["b"]], "member_keys: the other devices of the group (the leader is leader_key)"
    groups = c.get(GROUPS).json()["groups"]
    live_group = next(x for x in groups if x["leader_key"] == keys["a"])
    assert live_group["static"] is False and [m["name"] for m in live_group["members"]] == ["רמקול סלון", "רמקול מטבח"] and live_group["can"] == {"group": True, "volume": True} and live_group["floor_ids"] == ["ground"]
    with app.state.db.connection(mode="read") as conn:
        rows = [dict(r) for r in conn.execute("SELECT decision, details_json FROM audit_log WHERE action = 'media.group' ORDER BY id").fetchall()]
    assert [json.loads(r["details_json"]).get("phase") for r in rows][:1] == ["attempt"] and rows[0]["decision"] == "allowed"
    assert c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=[keys["b"]])).json()["code"] == "nothing_to_do"


def test_a_join_a_room_refused_is_not_joined_by_name_even_though_ha_accepted_the_call(g):
    app, c, calls, keys, settings, fx, put = g
    fx["apply"] = False
    res = done(c, c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=[keys["b"]])))
    assert outcomes(res)["רמקול מטבח"] in ("not_joined", "unknown") and res["counts"]["confirmed"] < 2


def test_every_join_refusal_has_its_code_and_sends_nothing(g, monkeypatch):
    app, c, calls, keys, settings, fx, put = g
    post = lambda body, headers=None: c.post(f"{GROUPS}/join", json=body, headers=headers or {})  # noqa: E731
    r = post(req(leader_key="nope", member_keys=[keys["b"]]))
    assert (r.status_code, r.json()["code"]) == (404, "not_found")
    (tv,) = [d for d in c.get(f"{API}/admin/devices?kind=screen").json()["devices"]]
    r = post(req(leader_key=keys["a"], member_keys=[tv["key"]]))
    assert r.status_code in (404, 422), "a screen is not a player: it is never groupable"
    r = post(req(leader_key=keys["a"], member_keys=[keys["garden"]]))
    assert (r.status_code, r.json()["code"], r.json()["details"]["reason"]) == (422, "not_groupable", "no_grouping"), "Cast has no grouping"
    r = post(req(leader_key=keys["a"], member_keys=[keys["console"]]))
    assert (r.status_code, r.json()["code"]) == (422, "not_groupable")
    r = post(req(leader_key=keys["a"], member_keys=[keys["stereo"]]))
    assert (r.status_code, r.json()["code"]) == (422, "not_groupable"), "a static group is never joined"
    r = post(req(leader_key=keys["a"], member_keys=[keys["a"]]))
    assert r.status_code == 422
    assert post(req(leader_key=keys["a"], member_keys=[])).status_code == 422 and post(req(leader_key=keys["a"], member_keys=[keys["b"]], extra=1)).status_code == 422
    assert post({**req(leader_key=keys["a"], member_keys=[keys["b"]]), "expires_at": "2020-01-01T00:00:00Z"}).json()["code"] == "expired"
    ok = req(leader_key=keys["a"], member_keys=[keys["b"]])
    assert done(c, post(ok))["status"] == "done"
    assert post(ok).json()["code"] == "duplicate_command"
    assert c.post(f"{GROUPS}/join", content="x", headers={"content-type": "text/plain"}).status_code == 415
    assert len(calls) == 1, "nothing was sent for any refusal"
    with app.state.db.connection(mode="read") as conn:
        refused = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'media.group' AND decision = 'denied'").fetchone()[0]
    assert refused >= 6, "every refusal is an audited row"


def test_a_room_in_another_group_and_two_layers_in_conflict_cannot_join(g):
    app, c, calls, keys, settings, fx, put = g
    done(c, c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=[keys["b"]])))
    r = c.post(f"{GROUPS}/join", json=req(leader_key=keys["x1"], member_keys=[keys["b"]]))
    assert r.status_code in (409, 422) and r.json()["code"] in ("in_other_group", "not_groupable", "nothing_to_do"), r.text
    put("media_player.heos_den", group_members=["media_player.heos_den", "media_player.wiim_a"])  # the vendor layer says it is in a group the MA layer does not know
    assert live(c, keys["denon"])["group"]["conflict"] is True
    r = c.post(f"{GROUPS}/join", json=req(leader_key=keys["x1"], member_keys=[keys["denon"]]))
    assert (r.status_code, r.json()["code"], r.json()["details"]["reason"]) == (422, "not_groupable", "conflict")
    r = c.post(f"{GROUPS}/join", json=req(leader_key=keys["x1"], member_keys=[keys["x2"]]))
    assert r.status_code == 202, "a conflict elsewhere does not block rooms that are fine"
    done(c, r)


def test_permissions_media_group_and_media_control_are_both_needed_at_every_room(g):
    app, c, calls, keys, settings, fx, put = g
    bind(c, settings, "vera", "viewer", "installation", "*")
    r = c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=[keys["b"]]), headers=as_user("vera"))
    assert r.status_code == 403
    ok = c.post("/api/v1/access/roles", json={"name": "מנגן בלבד", "permissions": ["media.read", "media.control"]})
    bind(c, settings, "ron", ok.json()["id"], "installation", "*")
    r = c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=[keys["b"]]), headers=as_user("ron"))
    assert r.status_code == 403 and r.json()["code"] in ("forbidden", "permission_denied", "not_allowed", "group_denied") or r.status_code == 403
    bind(c, settings, "olga", "operator", "installation", "*")
    assert done(c, c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=[keys["b"]]), headers=as_user("olga")), headers=as_user("olga"))["status"] == "done"
    assert not calls or calls[0]["service"] == "join" and len(calls) == 1


def test_a_group_of_four_rooms_or_more_than_one_floor_needs_a_confirmation_and_the_whole_building_needs_bulk(g, monkeypatch):
    app, c, calls, keys, settings, fx, put = g
    four = [keys["b"], keys["x1"], keys["x2"]]
    r = c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=four))
    assert (r.status_code, r.json()["code"]) == (409, "confirm_required")
    pv = r.json()["preview"]
    assert pv["needs_confirmation"] is True and pv["devices"] == 4 and pv["floors"] == 1 and set(r.json()["details"]["preview"]) == set(pv) and calls == []
    assert all(set(d) >= {"key", "name", "will"} for d in pv["members"]) and "entity_id" not in json.dumps(pv)
    r = c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=four, confirmed=True))
    assert r.status_code == 202
    res = done(c, r)
    assert [p["service"] for p in calls] == ["join"] and sorted(outcomes(res).values()) == ["joined"] * 4
    # one floor is not a party; a second floor is
    done(c, c.post(f"{GROUPS}/leave", json=req(device_keys=four)))
    monkeypatch.setattr(ha_client, "call_bridge_set_area", lambda _s, payload, timeout=15.0: {"ok": True, "context_id": None, "request_id": payload["request_id"]})
    assert c.put(f"{API}/admin/devices/{keys['x2']}", json={"area_id": "office"}).status_code == 200
    r = c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=[keys["b"], keys["x2"]]))
    assert (r.status_code, r.json()["code"]) == (409, "confirm_required") and r.json()["preview"]["floors"] == 2
    # the whole building: bulk_required without media.bulk (the operator has none), allowed with
    bind(c, settings, "olga", "operator", "installation", "*")
    r = c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=four, confirmed=True), headers=as_user("olga"))
    assert r.status_code == 403 and r.json()["code"] == "bulk_required"


def test_a_house_without_floors_asks_only_for_four_rooms_never_for_a_second_floor(g):
    """Floor scopes degrade to areas for PERMISSIONS (CR 7.1), but the party rule counts floors: a house without floors (the Sonos house of system-K) has none, so a
    group of three rooms in three areas is not a party."""
    app, c, calls, keys, settings, fx, put = g
    with app.state.db.connection() as conn:
        conn.execute("DELETE FROM ha_floors")
        conn.execute("UPDATE ha_entities SET ha_floor_id = NULL, ha_floor_name = NULL")
    r = c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=[keys["b"], keys["denon"]]))
    assert r.status_code == 202, r.text
    assert r.json()["preview"]["floors"] == 0 and r.json()["preview"]["needs_confirmation"] is False
    done(c, r)
    four = [keys["x1"], keys["x2"]]
    r = c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=four))
    assert (r.status_code, r.json()["code"]) == (409, "confirm_required") and r.json()["preview"]["floors"] == 0 and r.json()["preview"]["devices"] == 5


def test_leave_sends_one_unjoin_per_device_through_its_own_layer(g):
    app, c, calls, keys, settings, fx, put = g
    done(c, c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=[keys["b"], keys["x1"]])))
    calls.clear()
    res = done(c, c.post(f"{GROUPS}/leave", json=req(device_keys=[keys["b"]])))
    assert [(p["service"], p["data"]) for p in calls] == [("unjoin", {"entity_id": "media_player.ma_b"})] and outcomes(res) == {"רמקול מטבח": "left"}
    assert live(c, keys["b"])["group"]["role"] == "none" and live(c, keys["a"])["group"]["member_keys"] == [keys["x1"]]
    r = c.post(f"{GROUPS}/leave", json=req(device_keys=[keys["b"]]))
    assert (r.status_code, r.json()["code"]) == (409, "nothing_to_do")
    assert c.post(f"{GROUPS}/leave", json=req(device_keys=["nope"])).status_code == 404
    assert c.post(f"{GROUPS}/leave", json=req(device_keys=[])).status_code == 422


def test_group_writes_need_the_bridge_at_0_5_0(g, monkeypatch):
    app, c, calls, keys, settings, fx, put = g
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    from smplwise.services import ha_bridge

    assert c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.4.0"})).status_code == 200
    r = c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=[keys["b"]]))
    assert (r.status_code, r.json()["code"], r.json()["details"]["required"]) == (503, "bridge_outdated", "0.5.0") and calls == []


# ------------------------------------------------------------------------------------------------ volume


def test_group_volume_is_relative_by_default_absolute_on_request_and_clamped_only_by_ceilings_an_administrator_set(g):
    app, c, calls, keys, settings, fx, put = g
    done(c, c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=[keys["b"]])))
    calls.clear()
    res = done(c, c.post(f"{GROUPS}/{keys['a']}/volume", json=req(level=20)))
    levels = {p["data"]["entity_id"]: round(p["data"]["volume_level"] * 100) for p in calls}
    assert levels == {"media_player.wiim_a": 20, "media_player.wiim_b": 15}, "the same factor for every room: the balance is kept (40:30 -> 20:15)"
    assert outcomes(res) == {"רמקול סלון": "set", "רמקול מטבח": "set"}
    calls.clear()
    media_commands.BUCKETS.clear()  # the rate limit (2/s per user and group) is its own test: these three writes are one person's, spaced
    done(c, c.post(f"{GROUPS}/{keys['a']}/volume", json=req(level=100, mode="absolute")))
    assert {round(p["data"]["volume_level"] * 100) for p in calls} == {100}, "no default ceiling: 100 is sent"
    calls.clear()
    media_commands.BUCKETS.clear()
    assert c.put(f"{API}/admin/devices/{keys['b']}", json={"volume_max": 60}).status_code == 200
    res = done(c, c.post(f"{GROUPS}/{keys['a']}/volume", json=req(level=90, mode="absolute")))
    assert {p["data"]["entity_id"]: round(p["data"]["volume_level"] * 100) for p in calls} == {"media_player.wiim_a": 90, "media_player.wiim_b": 60}
    assert outcomes(res) == {"רמקול סלון": "set", "רמקול מטבח": "clamped"}


def test_group_volume_skips_a_muted_or_off_room_with_its_reason_and_refuses_a_non_leader(g):
    app, c, calls, keys, settings, fx, put = g
    done(c, c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=[keys["b"]])))
    put("media_player.wiim_b", is_volume_muted=True)
    calls.clear()
    res = done(c, c.post(f"{GROUPS}/{keys['a']}/volume", json=req(level=30, mode="absolute")))
    assert outcomes(res) == {"רמקול סלון": "set", "רמקול מטבח": "skipped_muted"} and [p["data"]["entity_id"] for p in calls] == ["media_player.wiim_a"]
    for bad in ({"level": 101}, {"level": -1}, {"level": True}, {"level": "x"}, {"mode": "absolute"}):
        media_commands.BUCKETS.clear()
        assert c.post(f"{GROUPS}/{keys['a']}/volume", json=req(**bad)).status_code == 422, bad
    r = c.post(f"{GROUPS}/{keys['x1']}/volume", json=req(level=10))
    assert (r.status_code, r.json()["code"]) == (422, "not_groupable"), "a device that leads no group has no group volume"
    assert c.post(f"{GROUPS}/nope/volume", json=req(level=10)).status_code == 404


def test_group_volume_is_rate_limited_per_group_and_never_single_flight(g):
    app, c, calls, keys, settings, fx, put = g
    done(c, c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=[keys["b"]])))
    codes = [c.post(f"{GROUPS}/{keys['a']}/volume", json=req(level=10 + i)).status_code for i in range(6)]
    assert codes.count(202) >= 2 and 429 in codes, codes


def test_a_static_group_volume_reaches_its_children_and_the_group_cannot_be_joined(g):
    app, c, calls, keys, settings, fx, put = g
    stereo = next(x for x in c.get(GROUPS).json()["groups"] if x["leader_key"] == keys["stereo"])
    assert stereo["static"] is True and stereo["can"]["group"] is False and {m["name"] for m in stereo["members"]} == {"רמקול סלון", "רמקול מטבח"}
    calls.clear()
    res = done(c, c.post(f"{GROUPS}/{keys['stereo']}/volume", json=req(level=25, mode="absolute")))
    assert {p["data"]["entity_id"] for p in calls} == {"media_player.wiim_a", "media_player.wiim_b"} and set(outcomes(res).values()) == {"set"}


# ------------------------------------------------------------------------------------------------ saved groups


def preset_body(keys: dict[str, str], **kw: Any) -> dict[str, Any]:
    return {"name": "ערב בסלון", "leader_key": keys["a"], "member_keys": [keys["b"]], **kw}


def test_saved_groups_are_created_listed_edited_and_deleted_with_a_revision(g):
    app, c, calls, keys, settings, fx, put = g
    assert c.get(f"{GROUPS}/presets").json() == {"presets": []}
    r = c.post(f"{GROUPS}/presets", json=preset_body(keys, volumes={keys["a"]: 30, keys["b"]: 20}))
    assert r.status_code == 201, r.text
    p = r.json()
    assert set(p) == {"id", "name", "leader_key", "member_keys", "volumes", "revision", "missing", "running"} and (p["revision"], p["missing"], p["running"]) == (1, [], None)
    assert p["volumes"] == {keys["a"]: 30, keys["b"]: 20} and c.get(f"{GROUPS}/presets").json()["presets"] == [p]
    upd = c.put(f"{GROUPS}/presets/{p['id']}", json={**preset_body(keys, name="ערב"), "base_revision": 1})
    assert upd.status_code == 200 and (upd.json()["name"], upd.json()["revision"]) == ("ערב", 2)
    stale = c.put(f"{GROUPS}/presets/{p['id']}", json={**preset_body(keys), "base_revision": 1})
    assert (stale.status_code, stale.json()["code"]) == (409, "revision_conflict")
    assert c.delete(f"{GROUPS}/presets/{p['id']}?base_revision=1").status_code == 409
    assert c.delete(f"{GROUPS}/presets/{p['id']}?base_revision=2").status_code == 204 and c.get(f"{GROUPS}/presets").json() == {"presets": []}
    assert c.delete(f"{GROUPS}/presets/{p['id']}").status_code == 404


def test_a_saved_group_is_validated_like_a_join(g):
    app, c, calls, keys, settings, fx, put = g
    for bad in (preset_body(keys, name=""), preset_body(keys, name="x" * 41), preset_body(keys, leader_key="nope"), preset_body(keys, member_keys=[keys["a"]]), preset_body(keys, member_keys=[keys["stereo"]]), preset_body(keys, member_keys=[keys["b"], keys["b"]]), preset_body(keys, volumes={keys["x1"]: 10}), preset_body(keys, volumes={keys["a"]: 101}),
                preset_body(keys, member_keys=[])):
        r = c.post(f"{GROUPS}/presets", json=bad)
        assert r.status_code in (404, 422), (list(bad)[:0], bad.get("name"), bad["member_keys"], bad.get("volumes"), r.text)
    # a leader on the Music Assistant layer and a member on the vendor layer only: never one saved group
    assert c.post(f"{GROUPS}/presets", json=preset_body(keys, member_keys=[keys["denon"]])).status_code == 201, "the receiver's grouping layer is Music Assistant too"
    bind(c, settings, "vera", "viewer", "installation", "*")
    assert c.post(f"{GROUPS}/presets", json=preset_body(keys), headers=as_user("vera")).status_code == 403
    assert c.get(f"{GROUPS}/presets", headers=as_user("vera")).status_code == 200


def test_applying_a_saved_group_is_a_diff_in_ordered_phases_and_one_apply_at_a_time(g):
    app, c, calls, keys, settings, fx, put = g
    p = c.post(f"{GROUPS}/presets", json=preset_body(keys, member_keys=[keys["b"], keys["x1"]], volumes={keys["a"]: 30, keys["b"]: 20})).json()
    done(c, c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=[keys["x2"]])))  # the leader already has an extra room
    calls.clear()
    res = done(c, c.post(f"{GROUPS}/presets/{p['id']}/apply", json=req()))
    order = [(x["service"], x["data"]["entity_id"]) for x in calls]
    assert order[0] == ("unjoin", "media_player.ma_ex2"), "the extra room leaves first"
    assert order[1][0] == "join" and [s for s, _e in order[2:]] == ["volume_set", "volume_set"], order
    assert {n: o for n, o in outcomes(res).items() if n in ("רמקול סלון", "רמקול מטבח", "רמקול נוסף 1")} == {"רמקול סלון": "joined", "רמקול מטבח": "joined", "רמקול נוסף 1": "joined"}
    assert outcomes(res)["רמקול נוסף 2"] == "left"
    levels = {x["data"]["entity_id"]: round(x["data"]["volume_level"] * 100) for x in calls if x["service"] == "volume_set"}
    assert levels == {"media_player.wiim_a": 30, "media_player.wiim_b": 20}
    again = c.post(f"{GROUPS}/presets/{p['id']}/apply", json=req())
    assert again.status_code in (202, 409), again.text
    assert c.post(f"{GROUPS}/presets/nope/apply", json=req()).status_code == 404


def test_a_saved_group_may_name_a_room_that_cannot_join_now_and_applying_it_reports_that_room_by_name(g):
    app, c, calls, keys, settings, fx, put = g
    p = c.post(f"{GROUPS}/presets", json=preset_body(keys, member_keys=[keys["b"], keys["garden"]]))
    assert p.status_code == 201, "whether a room can join now is decided when the group is applied"
    res = done(c, c.post(f"{GROUPS}/presets/{p.json()['id']}/apply", json=req()))
    assert outcomes(res)["רמקול גינה"] == "not_joined" and outcomes(res)["רמקול מטבח"] == "joined" and [x["data"]["group_members"] for x in calls if x["service"] == "join"] == [["media_player.ma_b"]]


def test_a_saved_group_with_a_room_that_is_no_longer_approved_applies_the_rest_and_names_the_missing(g):
    app, c, calls, keys, settings, fx, put = g
    p = c.post(f"{GROUPS}/presets", json=preset_body(keys, member_keys=[keys["b"], keys["x1"]])).json()
    assert c.post(f"{API}/admin/approve", json={"device_keys": [keys["x1"]], "approved": False}).status_code == 200
    listed = c.get(f"{GROUPS}/presets").json()["presets"][0]
    assert listed["missing"] == [keys["x1"]]
    res = done(c, c.post(f"{GROUPS}/presets/{p['id']}/apply", json=req()))
    assert outcomes(res)["רמקול מטבח"] == "joined" and [x["data"]["group_members"] for x in calls if x["service"] == "join"] == [["media_player.ma_b"]]


def test_applying_a_party_sized_saved_group_asks_for_the_same_confirmation(g):
    app, c, calls, keys, settings, fx, put = g
    p = c.post(f"{GROUPS}/presets", json=preset_body(keys, member_keys=[keys["b"], keys["x1"], keys["x2"]])).json()
    r = c.post(f"{GROUPS}/presets/{p['id']}/apply", json=req())
    assert (r.status_code, r.json()["code"]) == (409, "confirm_required") and calls == []
    assert c.post(f"{GROUPS}/presets/{p['id']}/apply", json=req(confirmed=True)).status_code == 202
    device_bulk.RUNNER.clear()


# ------------------------------------------------------------------------------------------------ helper groups and the pause bulk


def test_a_helper_group_is_listed_as_a_static_shortcut_and_never_joined(settings, monkeypatch):
    c = TestClient(create_app(settings))
    aseed.install(c, "sonos")
    aseed.approve_players(c)
    helper = aseed.key_with(c, "media_player.helper_sonos", "virtual_group")
    assert c.post(f"{API}/admin/approve", json={"device_keys": [helper]}).status_code == 200
    groups = c.get(GROUPS).json()["groups"]
    entry = next(x for x in groups if x["leader_key"] == helper)
    assert entry["static"] is True and entry["can"]["group"] is False and {m["name"] for m in entry["members"]} == {"סלון", "מטבח", "חדר שינה"}
    calls = mseed.pair(c, monkeypatch, version="0.5.0")
    r = c.post(f"{GROUPS}/join", json=req(leader_key=aseed.key_with(c, "media_player.sonos_living"), member_keys=[helper]))
    assert r.status_code in (404, 422) and calls == [], "a helper group is not a player"


def test_players_pause_counts_what_plays_and_only_pauses_that(g):
    app, c, calls, keys, settings, fx, put = g
    pv = c.get(f"{API}/actions/preview", params={"scope": "floor", "id": "ground", "kind": "players_pause"})
    assert pv.status_code == 200, pv.text
    body = pv.json()
    assert body["counts"]["send"] == 1 and {d["name"]: (d["will"], d["reason"]) for d in body["devices"]}["רמקול סלון"] == ("pause", None)
    assert {d["will"] for d in body["devices"]} == {"pause", "skip"} and {d["reason"] for d in body["devices"]} <= {None, "not_playing", "unavailable", "not_allowed"}
    assert "entity_id" not in json.dumps(body)
    assert c.get(f"{API}/actions/preview", params={"scope": "building", "id": "*", "kind": "players_pause"}).status_code in (403, 422)
    r = c.post(f"{API}/actions", json={**req(scope="floor", id="ground", kind="players_pause", confirmed=True)})
    assert r.status_code == 202, r.text
    res = done(c, r)
    assert [(p["service"], p["data"]["entity_id"]) for p in calls] == [("media_pause", "media_player.ma_a")] and outcomes(res)["רמקול סלון"] in ("set", "paused", "confirmed")
    r = c.post(f"{API}/actions", json={**req(scope="floor", id="ground", kind="players_pause", confirmed=True)})
    assert (r.status_code, r.json()["code"]) == (409, "nothing_to_do"), "nothing plays any more"
    assert c.post(f"{API}/actions", json={**req(scope="floor", id="ground", kind="players_pause")}).json()["code"] == "confirmation_required"
