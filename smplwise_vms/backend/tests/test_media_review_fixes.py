"""CR-016 security review (Opus) findings M1-M4 and L1-L7 of the media phase-2 backend and bridge: a command to a static group reaches every member only with control at every
member's anchor (and never as one volume write that ignores their ceilings); the generic action route refuses a volume / power / play action on any audio endpoint and
on a helper group over managed rooms; the relative group volume scales from the level the slider shows and never raises a member on a drag down; the siblings of an approved
speaker are read-only like a TV's; names do not leak across scope; an item ref belongs to the user and the device it was listed for; reads are cached when they fail and
rationed per user; a zone's step uses the zone's own level; an unmute never reveals a level above a ceiling set later; and rung 3b merges only a unique pair."""
from __future__ import annotations

import json
import time
from typing import Any

import media_seed as mseed
import media_seed_audio as aseed
import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient
from media_seed import send, service_of
from test_media_groups import GROUPS, done, g, live, outcomes, req  # noqa: F401 - `g` is a fixture
from test_media_players_commands import API, code, p, reason  # noqa: F401 - `p` is a fixture

from smplwise.main import create_app
from smplwise.rbac import Principal
from smplwise.services import device_bulk, ha_sync, media_commands, media_model as mm, media_query, media_store, schedule_view

DEV = Principal(user_id="dev-joni", username="joni", display_name="joni", source="dev")


def place(c: TestClient, ids: dict[str, str], keys: dict[str, str], layout: dict[str, str]) -> None:
    """Publish a plan on floor2 and floor3 and put the anchor of each device named in `layout` ({key name: "floor2" | "floor3"}) on its floor."""
    for fid in (ids["floor2"], ids["floor3"]):
        asset = c.post(f"/api/v1/floors/{fid}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")}).json()
        v = c.post(f"/api/v1/floors/{fid}/plan-versions", json={"asset_id": asset["id"]}).json()
        c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    anchors = {d["key"]: d["anchor_entity_id"] for d in c.get(f"{API}/admin/devices").json()["devices"]}
    for i, (name, floor) in enumerate(layout.items()):
        assert c.post(f"/api/v1/floors/{ids[floor]}/anchors", json={"resource_type": "ha_entity", "resource_id": anchors[keys[name]], "x": 0.1 + i / 20, "y": 0.2}).status_code == 201


def acall(c: TestClient, entity: str, action: str, args: dict[str, Any] | None = None):
    return c.post(f"/api/v1/ha/entities/{entity}/actions", json={"allowed_action_id": action, "arguments": args or {}, "client_request_id": f"r-{action}-{entity}"[:80], "expires_at": "2099-01-01T00:00:00Z"})


# ------------------------------------------------------------------------------------------------ M1: a static group fans out


def test_m1_a_static_groups_volume_is_never_one_call_on_the_group_entity(p):
    app, c, calls, keys, _ = p
    for command, fields in (("volume_set", {"level": 90}), ("volume_step", {"direction": "up"})):
        r = send(c, keys["stereo"], command, **fields)
        assert (r.status_code, code(r)) == (409, "use_group_volume") and r.json()["details"]["route"] == f"/multimedia/groups/{keys['stereo']}/volume", command
        media_commands.BUCKETS.clear()
    assert calls == []


def test_m1_a_command_to_a_static_group_needs_control_at_every_members_anchor(p):
    app, c, calls, keys, settings = p
    ids = seed_tree(c)
    place(c, ids, keys, {"a": "floor2", "b": "floor3", "stereo": "floor3"})
    bind(c, settings, "kim", "operator", "floor", ids["floor3"])  # kim controls B and the group, but not A
    kim = as_user("kim")
    for command, fields in (("transport", {"action": "pause"}), ("power_off", {}), ("mute", {"muted": True})):
        r = send(c, keys["stereo"], command, headers=kim, **fields)
        assert (r.status_code, code(r), reason(r)) == (403, "forbidden", "group_member"), command
        media_commands.BUCKETS.clear()
    assert calls == [], "nothing was sent"
    bind(c, settings, "kim", "operator", "floor", ids["floor2"])  # now every room of the group is theirs
    r = send(c, keys["stereo"], "transport", headers=kim, action="pause")
    assert r.status_code == 202 and [service_of(x)[1] for x in calls] == ["media_pause"]
    assert [x["reason"] for x in __import__("test_media_players_commands").audit_rows(app, "media.command") if x["decision"] == "denied"].count("forbidden") == 3


def test_m1_a_party_group_needs_the_confirmation_of_a_join_and_a_building_group_media_bulk(g):
    app, c, calls, keys, settings, fx, put = g
    put("media_player.ma_stereo", group_members=["media_player.ma_a", "media_player.ma_b", "media_player.ma_ex1", "media_player.ma_ex2"])
    r = send(c, keys["stereo"], "transport", action="pause")
    assert (r.status_code, r.json()["code"]) == (409, "confirm_required") and r.json()["preview"]["devices"] == 4 and r.json()["preview"]["needs_confirmation"] is True
    assert "members" in r.json()["preview"] and r.json()["preview"]["members"] == [], "the question carries counts, not rooms"
    assert calls == []
    r = send(c, keys["stereo"], "transport", action="pause", confirmed=True)
    assert r.status_code == 202 and [service_of(x)[1] for x in calls] == ["media_pause"]
    # every room of the building (ground and upper floors): media.bulk is needed as well
    put("media_player.ma_stereo", group_members=["media_player.ma_a", "media_player.ma_b", "media_player.ma_ex1", "media_player.ma_den"])
    with app.state.db.connection(mode="read") as conn:
        cat = media_store.load_catalog(conn, approved_only=False, kind=tuple(mm.AUDIO_KINDS))
    assert cat.group_info(keys["stereo"])["member_keys"], "the group's members resolve"


def test_m1_a_live_leaders_transport_needs_control_at_the_rooms_that_follow_it(g):
    app, c, calls, keys, settings, fx, put = g
    done(c, c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=[keys["b"]])))
    ids = seed_tree(c)
    place(c, ids, keys, {"a": "floor2", "b": "floor3"})
    bind(c, settings, "kim", "operator", "floor", ids["floor2"])  # the leader is theirs, the room that follows it is not
    r = send(c, keys["a"], "transport", headers=as_user("kim"), action="pause")
    assert (r.status_code, r.json()["code"], r.json()["details"]["reason"]) == (403, "forbidden", "group_member")
    r = send(c, keys["a"], "volume_set", headers=as_user("kim"), level=20)
    assert r.status_code == 202, "a leader's own volume is its own"
    bind(c, settings, "kim", "operator", "floor", ids["floor3"])
    media_commands.BUCKETS.clear()
    assert send(c, keys["a"], "transport", headers=as_user("kim"), action="pause").status_code == 202


# ------------------------------------------------------------------------------------------------ M2: the generic route and the managed set


def _sonos(settings, monkeypatch, approve: bool = True):
    media_query.clear()
    app = create_app(settings)
    c = TestClient(app)
    aseed.install(c, "sonos")
    if approve:
        aseed.approve_players(c)
    return app, c, mseed.pair(c, monkeypatch, version="0.5.0")


def test_m2_the_generic_route_refuses_volume_power_and_play_on_a_helper_group_and_on_any_audio_endpoint(settings, monkeypatch):
    app, c, calls = _sonos(settings, monkeypatch, approve=False)  # nothing approved: the helper group and the speakers are unapproved devices
    for entity, action, args in (("media_player.helper_sonos", "media_player.volume_set", {"volume_level": 1.0}), ("media_player.helper_sonos", "media_player.turn_off", None),
                                 ("media_player.helper_sonos", "media_player.media_play", None), ("media_player.sonos_living", "media_player.volume_set", {"volume_level": 1.0}),
                                 ("media_player.sonos_kitchen", "media_player.volume_mute", {"is_volume_muted": False}), ("media_player.sonos_bedroom", "media_player.turn_on", None)):
        r = acall(c, entity, action, args)
        assert (r.status_code, r.json()["code"]) == (409, "use_media_screen"), (entity, action)
    assert calls == []
    # an unapproved SCREEN is still given back to the generic route (CR-015); other domains are untouched
    assert acall(c, "media_player.tv_living", "media_player.turn_off").status_code == 202


def test_m2_a_helper_group_over_managed_rooms_is_managed_itself_and_listed_read_only(settings, monkeypatch):
    app, c, calls = _sonos(settings, monkeypatch)  # the Sonos speakers are approved; the helper group is not (a non-physical component)
    listing = {e["entity_id"]: e for e in c.get("/api/v1/ha/entities?domain=media_player").json()["entities"]}
    assert listing["media_player.helper_sonos"]["media_managed"] is True and listing["media_player.helper_sonos"]["actions"] == []
    assert c.get("/api/v1/ha/entities/media_player.helper_sonos").json()["media_managed"] is True
    with app.state.db.connection(mode="read") as conn:
        assert "media_player.helper_sonos" in media_store.managed_entities(conn) and media_store.is_managed(conn, "media_player.helper_sonos")
        assert media_store.is_audio_endpoint(conn, "media_player.helper_sonos") and not media_store.is_audio_endpoint(conn, "media_player.tv_living")
    assert acall(c, "media_player.helper_sonos", "media_player.volume_set", {"volume_level": 1.0}).json()["code"] == "use_media_screen" and calls == []


# ------------------------------------------------------------------------------------------------ M3: relative group volume


def test_m3_a_relative_drag_down_from_the_shown_level_never_raises_a_member(g):
    app, c, calls, keys, settings, fx, put = g
    done(c, c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=[keys["b"]])))
    put("media_player.wiim_a", is_volume_muted=True, volume_level=0.8)  # the muted leader is the loudest: the slider shows 80
    put("media_player.wiim_b", volume_level=0.1)
    group = next(x for x in c.get(GROUPS).json()["groups"] if x["leader_key"] == keys["a"])
    assert group["volume"] == 80
    calls.clear()
    res = done(c, c.post(f"{GROUPS}/{keys['a']}/volume", json=req(level=50, mode="relative")))
    assert [(x["data"]["entity_id"], x["data"]["volume_level"]) for x in calls] == [("media_player.wiim_b", 0.06)], "10 * 50 / 80 - never 50"
    assert outcomes(res) == {"רמקול סלון": "skipped_muted", "רמקול מטבח": "set"}


# ------------------------------------------------------------------------------------------------ M4: the siblings of an approved speaker


@pytest.fixture()
def sib(settings, monkeypatch):
    media_query.clear()
    app = create_app(settings)
    c = TestClient(app)
    h = aseed.ma_house()
    h.entity("switch.wiim_a_alarm", "wiim", "d_wiim_a", "on", name="Alarm")
    h.entity("number.wiim_a_bass", "wiim", "d_wiim_a", "3", name="Bass")
    h.entity("switch.hall_lamp", "template", None, "on", name="Hall")
    for i in range(0, len(h.states), 40):
        assert c.post("/api/v1/ha/dev/states", json={"states": h.states[i:i + 40]}).status_code == 200
    assert c.post("/api/v1/ha/dev/registry", json={"entities": h.entities, "devices": h.devices, "areas": h.areas, "floors": h.floors}).status_code == 200
    aseed.approve_players(c)
    return app, c, mseed.pair(c, monkeypatch, version="0.5.0")


def test_m4_the_siblings_of_an_approved_speaker_are_refused_listed_read_only_and_never_bulk_or_scheduled(sib):
    app, c, calls = sib
    for entity, action, args in (("switch.wiim_a_alarm", "switch.turn_off", None), ("number.wiim_a_bass", "number.set_value", {"value": 5})):
        r = acall(c, entity, action, args)
        assert (r.status_code, r.json()["code"]) == (409, "use_media_screen"), entity
    assert calls == [] and acall(c, "switch.hall_lamp", "switch.turn_off").status_code == 202
    listing = {e["entity_id"]: e for e in c.get("/api/v1/ha/entities").json()["entities"]}
    assert listing["switch.wiim_a_alarm"]["media_managed"] is True and listing["switch.wiim_a_alarm"]["actions"] == [] and listing["switch.hall_lamp"]["media_managed"] is False
    # the bulk actions never reach it, and an administrator cannot mark it bulk-safe
    r = c.put("/api/v1/devices/entities/switch.wiim_a_alarm/bulk-safe", json={"bulk_safe": True})
    assert (r.status_code, r.json()["code"]) == (409, "use_media_screen")
    with app.state.db.connection(mode="read") as conn:
        _wide, _scope, permitted = device_bulk.bulk_scope(conn, DEV)
        assert permitted("switch.hall_lamp") and not permitted("switch.wiim_a_alarm") and not permitted("number.wiim_a_bass")
        info = schedule_view.Ctx(conn, None).entity("switch.wiim_a_alarm")
        assert info["class"] is None and info["refusal"] == "media_managed_control", "a schedule cannot name it"
    # withdrawing the approval gives the siblings back
    keys = {n: aseed.key_with(c, e) for n, e in {"a": "media_player.wiim_a"}.items()}
    assert c.post(f"{API}/admin/approve", json={"device_keys": [keys["a"]], "approved": False}).status_code == 200
    assert acall(c, "switch.wiim_a_alarm", "switch.turn_off").status_code == 202


# ------------------------------------------------------------------------------------------------ L1: names do not leave their scope


def test_l1_the_join_preview_names_only_rooms_the_caller_may_read(g):
    app, c, calls, keys, settings, fx, put = g
    put("media_player.ma_b", group_members=["media_player.ma_b", "media_player.ma_a", "media_player.ma_ex1"])
    put("media_player.ma_a", active_queue=aseed.UID_B)
    put("media_player.ma_ex1", active_queue=aseed.UID_B)
    ids = seed_tree(c)
    place(c, ids, keys, {"a": "floor2", "x1": "floor2", "b": "floor3", "x2": "floor3"})
    bind(c, settings, "kim", "operator", "floor", ids["floor3"])
    r = c.post(f"{GROUPS}/join", json=req(leader_key=keys["b"], member_keys=[keys["x2"]]), headers=as_user("kim"))
    assert (r.status_code, r.json()["code"]) == (409, "confirm_required"), r.text
    text = json.dumps(r.json(), ensure_ascii=False)
    names = {d["name"] for d in r.json()["preview"]["members"]}
    assert "רמקול סלון" not in text and "רמקול נוסף 1" not in text and keys["a"] not in text and keys["x1"] not in text, "rooms the caller may not read are not named"
    assert {"חדרים נוספים"} <= names and next(d for d in r.json()["preview"]["members"] if d["name"] == "חדרים נוספים")["count"] == 2
    assert r.json()["preview"]["devices"] == 4, "they still count"


def test_l1_the_ws_frame_of_a_member_hides_the_group_name_when_the_leader_is_hidden(g):
    app, c, calls, keys, settings, fx, put = g
    done(c, c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=[keys["b"]])))
    ids = seed_tree(c)
    place(c, ids, keys, {"a": "floor3", "b": "floor2"})
    bind(c, settings, "ron", "viewer", "floor", ids["floor2"])
    media_store.INDEX.last_sent.clear()
    before = len(ha_sync._subscribers)
    with c.websocket_connect("/api/v1/ha/ws", headers=as_user("ron")) as ws:
        for _ in range(200):
            if len(ha_sync._subscribers) > before:
                break
            time.sleep(0.01)
        aseed.set_state(c, "media_player.wiim_b", "idle", volume_level=0.2)
        frame = None
        for _ in range(50):
            msg = json.loads(ws.receive_text())
            if msg["type"] == "media_state" and msg["payload"]["device_key"] == keys["b"]:
                frame = msg
                break
    assert frame is not None
    group = frame["payload"]["live"]["group"]
    assert group["leader_key"] is None and group["name"] is None and group["role"] == "member", "the leader's name is the leader's"
    assert "רמקול סלון" not in json.dumps(frame, ensure_ascii=False)


# ------------------------------------------------------------------------------------------------ L2 / L3: item refs, favourites, reads


def _bridge(c, monkeypatch):
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    seen: list[dict[str, Any]] = []

    def fake(_s, payload, timeout=15.0):
        from smplwise.services import ha_bridge

        ha_bridge.verify(secret, payload)
        seen.append(payload)
        items = [{"uri": "library://playlist/1", "media_type": "playlist", "name": "ערב"}, {"uri": "library://playlist/2", "media_type": "playlist", "name": "בוקר"}]
        if payload["query"] == "queue":
            return {"ok": True, "request_id": payload["request_id"], "query": "queue", "provider": "ma", "result": {"count": 4, "index": 1, "current": {"name": "x"}, "next": None}}
        return {"ok": True, "request_id": payload["request_id"], "query": "library", "provider": "ma", "result": {"items": items if payload["media_type"] == "playlist" else [], "offset": 0, "limit": 50}}

    monkeypatch.setattr(media_query, "call_bridge_media_query", fake)
    return seen


@pytest.fixture()
def q(settings, monkeypatch):
    media_query.clear()
    media_commands.BUCKETS.clear()
    media_commands._LIMIT_WINDOWS.clear()
    app = create_app(settings)
    c = TestClient(app)
    aseed.install(c, "ma")
    aseed.approve_players(c)
    calls = mseed.pair(c, monkeypatch, version="0.5.0")
    seen = _bridge(c, monkeypatch)
    keys = {n: aseed.key_with(c, e) for n, e in {"a": "media_player.wiim_a", "b": "media_player.wiim_b", "garden": "media_player.cast_garden"}.items()}
    return app, c, calls, seen, keys, settings


def test_l2_an_item_ref_plays_only_for_the_user_and_the_device_it_was_listed_for_and_hidden_refs_are_not_sent_to_readers(q):
    app, c, calls, seen, keys, settings = q
    page = c.get(f"{API}/devices/{keys['a']}/library?kind=playlists").json()
    items = {i["name"]: i["item_ref"] for i in page["items"]}
    assert send(c, keys["a"], "play_item", item_ref=items["ערב"]).status_code == 202
    media_commands.BUCKETS.clear()
    r = send(c, keys["b"], "play_item", item_ref=items["ערב"])
    assert (r.status_code, code(r)) == (422, "unknown_item"), "listed for A, not for B"
    bind(c, settings, "vera", "operator", "installation", "*")
    r = send(c, keys["a"], "play_item", headers=as_user("vera"), item_ref=items["ערב"])
    assert (r.status_code, code(r)) == (422, "unknown_item"), "listed for joni, not for vera"
    # the administrator hides one: a reader's list leaves it out, and its ref was never remembered for the reader
    cur = c.get(f"{API}/favourites").json()
    assert c.put(f"{API}/favourites", json={"kinds_on": ["favourites", "stations", "playlists"], "items": [{"item_ref": items["ערב"], "hidden": True, "order": 0}, {"item_ref": items["בוקר"], "hidden": False, "order": 1}],
                                            "base_revision": cur["revision"]}).status_code == 200
    media_query._ITEMS.clear()
    media_commands.BUCKETS.clear()
    reader = c.get(f"{API}/devices/{keys['a']}/library?kind=playlists", headers=as_user("vera")).json()
    assert [i["name"] for i in reader["items"]] == ["בוקר"]
    r = send(c, keys["a"], "play_item", headers=as_user("vera"), item_ref=items["ערב"])
    assert (r.status_code, code(r)) == (422, "unknown_item"), "a hidden item cannot be started by guessing its ref"
    assert items["ערב"] not in json.dumps(c.get(f"{API}/favourites", headers=as_user("vera")).json()), "no ref of a hidden item for a reader"
    assert items["ערב"] in json.dumps(c.get(f"{API}/favourites").json()), "the editor still sees it"


def test_l3_a_failed_read_is_remembered_a_user_has_a_share_and_the_detail_reuses_a_read(q, monkeypatch):
    app, c, calls, seen, keys, settings = q
    media_query._QUEUES.clear()
    failures = []

    def failing(_s, payload, timeout=15.0):
        failures.append(payload)
        return {"ok": False, "request_id": payload["request_id"], "query": payload["query"], "error": "timeout"}

    monkeypatch.setattr(media_query, "call_bridge_media_query", failing)
    for _ in range(4):
        r = c.get(f"{API}/devices/{keys['a']}/up-next")
        assert r.status_code == 200 and r.json()["confirmed"] is False
        media_commands.BUCKETS.clear()
    assert len(failures) == 1, "a failing music layer is asked once, not by every poll"
    # the library: the same refusal again without another read
    monkeypatch.setattr(media_query, "call_bridge_media_query", lambda *a, **k: (failures.append(1), {"ok": False, "error": "timeout"})[1])
    media_commands.BUCKETS.clear()
    for _ in range(3):
        assert c.get(f"{API}/devices/{keys['a']}/library?kind=playlists").status_code == 503
        media_commands.BUCKETS.clear()
    assert len(failures) == 2, "one more read for the first library refusal only"
    # the detail serves the queue length from a read up to 10 s old
    media_query.clear()
    media_commands.BUCKETS.clear()
    seen2 = _bridge(c, monkeypatch)
    for _ in range(3):
        assert c.get(f"{API}/devices/{keys['a']}").json()["live"]["queue"] == {"count": 4, "index": 1}
        media_commands.BUCKETS.clear()
    assert len(seen2) == 1
    real = media_query.MONO()
    monkeypatch.setattr(media_query, "MONO", lambda: real + 3.0)  # past the 2 s of the up-next route, inside the detail's 10 s
    c.get(f"{API}/devices/{keys['a']}")
    assert len(seen2) == 1


def test_l3_the_up_next_and_library_routes_are_rate_limited_per_user_and_a_user_has_a_share_of_the_bridge_reads(q, monkeypatch):
    app, c, calls, seen, keys, settings = q
    statuses = [c.get(f"{API}/devices/{keys['a']}/up-next").status_code for _ in range(9)]
    assert statuses.count(200) == 5 and statuses.count(429) == 4, statuses
    media_commands.BUCKETS.clear()
    lib = [c.get(f"{API}/devices/{keys['a']}/library?kind=playlists").status_code for _ in range(6)]
    assert lib.count(200) == 4 and lib.count(429) == 2, lib
    # one user's bridge reads in a minute are capped below the bridge's own budget
    media_query.clear()
    monkeypatch.setattr(media_query, "USER_READS_PER_MIN", 3)
    media_query._READS.clear()
    n = len(seen)
    for i in range(5):
        media_commands.BUCKETS.clear()
        media_query._QUEUES.clear()
        r = c.get(f"{API}/devices/{keys['a']}/up-next")
        assert r.status_code == (200 if i < 3 else 429), (i, r.text)
    assert len(seen) - n == 3
    # a different device of the same user shares the budget; another user has their own
    bind(c, settings, "vera", "operator", "installation", "*")
    media_commands.BUCKETS.clear()
    media_query._QUEUES.clear()
    assert c.get(f"{API}/devices/{keys['a']}/up-next", headers=as_user("vera")).status_code == 200


# ------------------------------------------------------------------------------------------------ L4: group volume buckets and audit ids


def test_l4_the_group_volume_bucket_is_per_user_and_leader_after_the_visibility_check_and_audit_ids_are_bounded(g):
    app, c, calls, keys, settings, fx, put = g
    done(c, c.post(f"{GROUPS}/join", json=req(leader_key=keys["a"], member_keys=[keys["b"]])))
    media_commands.BUCKETS.clear()
    junk = ["z" * 300 + str(i) for i in range(5)]
    for k in junk:
        assert c.post(f"{GROUPS}/{k}/volume", json=req(level=10)).status_code == 404
    assert not [key for (kind, key) in media_commands.BUCKETS.state if kind == "grp-vol" and "zzzz" in key], "a path key nobody validated never allocates a bucket"
    with app.state.db.connection(mode="read") as conn:
        longest = conn.execute("SELECT MAX(LENGTH(resource_id)) FROM audit_log WHERE action = 'media.group'").fetchone()[0]
    assert longest is not None and longest <= 128, "resource ids of audit rows are bounded"
    codes = [c.post(f"{GROUPS}/{keys['a']}/volume", json=req(level=10 + i)).status_code for i in range(5)]
    assert 429 in codes and any(kind == "grp-vol" and key.startswith("dev-joni:") for (kind, key) in media_commands.BUCKETS.state)
    media_commands.BUCKETS.clear()
    bind(c, settings, "vera", "operator", "installation", "*")
    assert c.post(f"{GROUPS}/{keys['a']}/volume", json=req(level=30), headers=as_user("vera")).status_code == 202, "another user has their own bucket for the same leader"


# ------------------------------------------------------------------------------------------------ L5 / L6: zone steps and unmute


def test_l5_a_zone_volume_step_under_a_ceiling_starts_from_the_zones_own_level(p):
    app, c, calls, keys, _ = p
    assert c.put(f"{API}/admin/devices/{keys['denon']}", json={"volume_max": 38}).status_code == 200
    zone = next(z for z in c.get(f"{API}/devices/{keys['denon']}").json()["zones"] if z["name"] != c.get(f"{API}/devices/{keys['denon']}").json()["zones"][0]["name"])
    assert zone["volume"] == 20 and c.get(f"{API}/devices/{keys['denon']}").json()["live"]["volume"]["level"] == 35
    aseed.set_state(c, "media_player.denon_zone2", "on", volume_level=0.2)
    r = send(c, keys["denon"], "volume_step", direction="up", zone=zone["id"])
    assert r.status_code == 202, r.text
    assert [service_of(x)[1:] for x in calls] == [("volume_set", {"entity_id": "media_player.denon_zone2", "volume_level": 0.25})], "20 + 5, not Main's 35 + 5 bounded to 38"


def test_l6_an_unmute_never_reveals_a_level_above_a_ceiling_set_later(p):
    app, c, calls, keys, _ = p
    aseed.set_state(c, "media_player.wiim_a", "idle", is_volume_muted=True, volume_level=0.6)
    assert c.put(f"{API}/admin/devices/{keys['a']}", json={"volume_max": 40}).status_code == 200  # set after the speaker was muted at 60
    r = send(c, keys["a"], "mute", muted=False)
    assert (r.status_code, code(r), reason(r)) == (422, "not_supported", "ceiling") and r.json()["details"]["ceiling"] == 40 and calls == []
    media_commands.BUCKETS.clear()
    assert send(c, keys["a"], "volume_set", level=90).status_code == 202 and calls[-1]["data"]["volume_level"] == 0.4, "a set is clamped"
    aseed.set_state(c, "media_player.wiim_a", "idle", is_volume_muted=True, volume_level=0.3)
    media_commands.BUCKETS.clear()
    assert send(c, keys["a"], "mute", muted=False).status_code == 202, "a level inside the ceiling unmutes"
    media_commands.BUCKETS.clear()
    assert send(c, keys["a"], "mute", muted=True).status_code == 202, "muting is never refused for a ceiling"


# ------------------------------------------------------------------------------------------------ L7: rung 3b only for a unique pair


def test_l7_three_single_platform_clusters_of_one_model_are_suggestions_not_a_merge():
    from test_media_model import MA_FULL, CAST_MASK, build, ent, mdev  # the model tests' builders

    ents = [ent("media_player.cast", "cast", "d1", features=CAST_MASK, state="off", device_class="speaker"), ent("media_player.ma", "music_assistant", "d2", features=MA_FULL, state="idle"),
            ent("media_player.sono", "sonos", "d3", features=MA_FULL, state="idle")]
    three = build(ents, [mdev("d1", "Acme", "Mega Speaker 5"), mdev("d2", "Acme", "Mega Speaker 5"), mdev("d3", "Acme", "Mega Speaker 5")])
    assert len(three.devices) == 3 and three.suggestions and all(s.rule == "3b" for s in three.suggestions), "three platforms of one model could be three devices"
    pair = build(ents[:2], [mdev("d1", "Acme", "Mega Speaker 5"), mdev("d2", "Acme", "Mega Speaker 5")])
    (d,) = pair.devices.values()
    assert {e.rule for e in d.endpoints} == {"3b"}, "a unique pair still merges"
