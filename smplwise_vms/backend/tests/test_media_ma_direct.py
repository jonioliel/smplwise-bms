"""CR-016 phase 2b (docs/changes/CR-016-MEDIA-PLAYERS.md section 17): the direct Music Assistant connection - the installer-only settings with a write-only
token, the schema gate and the circuit, the full queue list with opaque rows and locked rows, queue edits (move / next / delete / clear) under media.queue
with the confirmation and the leader rule, the library browsed through the bridge and searched through the direct connection, and the fallback to the
Home Assistant depth. A fake Music Assistant server (`FakeMA`) replaces the HTTP transport; nothing leaves the test."""
from __future__ import annotations

import json
import logging
import os
from typing import Any

import media_seed as mseed
import media_seed_audio as aseed
import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import backup, ha_bridge, ma_direct, media_commands, media_query, media_queue

API = "/api/v1/multimedia"
TOKEN = "ma-test-token-0123456789abcdef"
URL = "http://ma.example.test:8095"


class FakeMA:
    """A Music Assistant server in memory: `info`, `players/all`, one queue per player id, `move_item` / `delete_item` / `clear`, `music/search`."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.schema = 28
        self.fail: str | None = None  # unreachable | unauthorized | refused
        self.rows = [{"queue_item_id": f"qi-{n}", "name": f"שיר {n}", "duration": 180 + n, "media_item": {"name": f"שיר {n}", "artists": [{"name": "אמן"}], "album": {"name": "אלבום"}}}
                     for n in range(8)]
        self.current, self.buffered = 2, 3

    def info(self, url: str) -> dict[str, Any]:
        self.calls.append(("info", {}))
        if self.fail == "unreachable":
            raise ma_direct.MaError("unreachable")
        return {"server_version": "2.10.4", "schema_version": self.schema, "base_url": "http://secret.example"}

    def call(self, url: str, token: str, command: str, args: dict[str, Any]) -> Any:
        assert url == URL and token == TOKEN
        self.calls.append((command, args))
        if self.fail == "unreachable":
            raise ma_direct.MaError("unreachable")
        if self.fail == "unauthorized":
            raise ma_direct.MaError("unauthorized")
        if self.fail == "refused" and command.startswith("player_queues/") and command != "player_queues/get_active_queue" and command != "player_queues/items":
            raise ma_direct.MaError("refused", 11)
        if command == "players/all":
            return [{"player_id": "a"}, {"player_id": "b"}]
        if command == "player_queues/get_active_queue":
            return {"queue_id": f"q-{args['player_id']}", "items": len(self.rows), "current_index": self.current, "index_in_buffer": self.buffered,
                    "shuffle_enabled": False, "repeat_mode": "off", "name": "secret queue name"}
        if command == "player_queues/items":
            return [dict(r, index=args["offset"] + i) for i, r in enumerate(self.rows[args["offset"]:args["offset"] + args["limit"]])]
        if command == "player_queues/move_item":
            i = next(n for n, r in enumerate(self.rows) if r["queue_item_id"] == args["queue_item_id"])
            row = self.rows.pop(i)
            self.rows.insert(i + args["pos_shift"], row)
            return None
        if command == "player_queues/delete_item":
            self.rows = [r for r in self.rows if r["queue_item_id"] != args["item_id_or_index"]]
            return None
        if command == "player_queues/clear":
            self.rows = self.rows[:self.current + 1]
            return None
        if command == "music/search":
            return {"tracks": [{"uri": "library://track/7", "media_type": "track", "name": "נמצא", "artists": [{"name": "אמנית"}]},
                               {"uri": "https://evil.example/x.mp3", "media_type": "track", "name": "כתובת"}],
                    "albums": [{"uri": "library://album/1", "media_type": "album", "name": "לא מהסוג"}]}
        raise AssertionError(command)


class Bridge:
    def __init__(self, secret: str) -> None:
        self.secret, self.requests, self.search_error = secret, [], None

    def __call__(self, _settings, payload, timeout=15.0):
        ha_bridge.verify(self.secret, payload)
        self.requests.append(payload)
        if payload["query"] == "queue":
            return {"ok": True, "request_id": payload["request_id"], "query": "queue", "provider": "ma",
                    "result": {"count": 8, "index": 2, "shuffle": False, "repeat": "off", "current": {"name": "שיר 2"}, "next": {"name": "שיר 3"}}}
        if payload["query"] == "search":
            if self.search_error:
                return {"ok": False, "request_id": payload["request_id"], "query": "search", "error": self.search_error}
            found = [{"uri": "library://album/7", "media_type": "album", "name": "נמצא בגשר", "artist": "אמנית", "image": "http://leak"},
                     {"uri": "https://evil.example/x", "media_type": "album", "name": "כתובת"}, {"uri": "library://track/9", "media_type": "track", "name": "סוג אחר"}]
            return {"ok": True, "request_id": payload["request_id"], "query": "search", "provider": "ma", "result": {"items": found, "limit": payload["limit"]}}
        items = [{"uri": f"library://{payload['media_type']}/{n}", "media_type": payload["media_type"], "name": f"פריט {n}", "artist": None} for n in range(payload["offset"], payload["offset"] + 3)]
        items.append({"uri": "file:///etc/passwd", "media_type": payload["media_type"], "name": "קובץ"})
        return {"ok": True, "request_id": payload["request_id"], "query": "library", "provider": "ma", "result": {"items": items, "offset": payload["offset"], "limit": payload["limit"]}}


@pytest.fixture()
def d(settings, monkeypatch):
    media_query.clear()
    media_queue.clear()
    ma_direct.reset()
    media_commands.BUCKETS.clear()
    fake = FakeMA()
    monkeypatch.setattr(ma_direct, "TRANSPORT", [fake])
    monkeypatch.setattr(media_queue, "EDIT_DEVICE", (100.0, 100.0))  # the rate-limit test puts the real one back
    app = create_app(settings)
    c = TestClient(app)
    aseed.install(c, "ma")
    aseed.approve_players(c)
    calls = mseed.pair(c, monkeypatch, version="0.5.0")
    bridge = Bridge(c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"])
    monkeypatch.setattr(media_query, "call_bridge_media_query", bridge)
    keys = {n: aseed.key_with(c, e) for n, e in {"a": "media_player.wiim_a", "b": "media_player.wiim_b", "garden": "media_player.cast_garden"}.items()}
    return app, c, fake, bridge, keys, settings, calls


def connect(c: TestClient) -> dict[str, Any]:
    r = c.put(f"{API}/admin/ma-connection", json={"enabled": True, "url": URL, "token": TOKEN})
    assert r.status_code == 200, r.text
    return r.json()


def audit_rows(app, action: str) -> list[dict[str, Any]]:
    with app.state.db.connection(mode="read") as conn:
        return [{**dict(r), "details": json.loads(r["details_json"] or "{}")} for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]


def body(**kw: Any) -> dict[str, Any]:
    import datetime as dt
    import uuid

    return {"client_request_id": uuid.uuid4().hex[:16], "expires_at": (dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=30)).isoformat().replace("+00:00", "Z"), **kw}


# ------------------------------------------------------------------------------------------------ settings and the token


def test_the_connection_is_installer_only_and_the_token_is_write_only(d):
    app, c, fake, bridge, keys, settings, _ = d
    assert c.get(f"{API}/admin/ma-connection").json()["state"] == "off"
    view = connect(c)
    assert view["token_set"] is True and view["url"] == URL and view["enabled"] is True and TOKEN not in json.dumps(view)
    path = ma_direct.secret_path(settings.data_dir)
    assert path.read_text(encoding="utf-8") == TOKEN
    if os.name != "nt":
        assert oct(path.stat().st_mode & 0o777) == "0o600"
    rows = audit_rows(app, "media.ma_connection")
    assert rows[-1]["details"] == {"op": "update", "url_changed": True, "token": "set", "enabled": True}
    assert TOKEN not in json.dumps(rows) and "ma.example" not in json.dumps(rows), "never a token or an address in the audit"
    # an operator neither reads nor writes it; the status tells only the state
    bind(c, settings, "olga", "operator", "installation", "*")
    assert c.get(f"{API}/admin/ma-connection", headers=as_user("olga")).status_code == 403
    assert c.put(f"{API}/admin/ma-connection", headers=as_user("olga"), json={"enabled": False}).status_code == 403
    status = c.get(f"{API}/status", headers=as_user("olga")).json()
    assert status["direct"] == {"state": "ready"} and "ma.example" not in json.dumps(status)
    # clearing the token switches the direct path off
    assert c.put(f"{API}/admin/ma-connection", json={"clear_token": True}).json()["token_set"] is False and not path.exists()
    assert c.get(f"{API}/admin/ma-connection").json()["state"] == "off"


@pytest.mark.parametrize("url", ["ftp://ma:8095", "http://user:pw@ma:8095", "http://ma:8095/api", "http://ma:8095?x=1", "http://ma:8095#f", "http://", "ma:8095", "http://m a:1",
                                 "http://ma:99999", "javascript://x"])
def test_the_address_must_be_a_plain_server_address(d, url):
    app, c, *_ = d
    r = c.put(f"{API}/admin/ma-connection", json={"url": url})
    assert (r.status_code, r.json()["code"]) == (422, "validation"), url


def test_valid_addresses_are_normalised():
    assert ma_direct.validate_url("HTTP://Music.Local:8095/") == "http://music.local:8095"
    assert ma_direct.validate_url("https://[fd00::1]:8095") == "https://[fd00::1]:8095"
    with pytest.raises(Exception):
        ma_direct.validate_url("http://ma:8095/x")


def test_a_short_or_odd_token_is_refused_and_enabled_needs_an_address(d):
    app, c, *_ = d
    assert c.put(f"{API}/admin/ma-connection", json={"token": "short"}).status_code == 422
    assert c.put(f"{API}/admin/ma-connection", json={"token": "x" * 20 + " y"}).status_code == 422
    assert c.put(f"{API}/admin/ma-connection", json={"enabled": True}).json()["code"] == "validation"
    assert c.put(f"{API}/admin/ma-connection", json={"surprise": 1}).status_code == 422


def test_the_address_never_enters_a_backup(d):
    app, c, *_ = d
    connect(c)
    with app.state.db.connection(mode="read") as conn:
        snap = backup.snapshot(conn)
    assert not [r for r in snap["settings"] if r["key"] == ma_direct.CONFIG_KEY]


def test_the_connection_test_reports_schema_players_and_failures(d):
    app, c, fake, *_ = d
    connect(c)
    out = c.post(f"{API}/admin/ma-connection/test").json()
    assert out == {"state": "ready", "server_version": "2.10.4", "schema_version": 28, "players": 2}
    assert c.get(f"{API}/admin/ma-connection").json()["last_test"]["players"] == 2
    fake.schema = 5
    assert c.post(f"{API}/admin/ma-connection/test").json()["state"] == "schema_too_old"
    assert c.get(f"{API}/admin/ma-connection").json()["state"] == "schema_too_old", "sticky until the settings change or a new test"
    fake.schema, fake.fail = 28, "unauthorized"
    assert c.post(f"{API}/admin/ma-connection/test").json()["state"] == "unauthorized"
    fake.fail = "unreachable"
    assert c.post(f"{API}/admin/ma-connection/test").json()["state"] == "unreachable"
    assert [r["details"]["state"] for r in audit_rows(app, "media.ma_connection") if r["details"]["op"] == "test"] == ["ready", "schema_too_old", "unauthorized", "unreachable"]


def test_the_command_allow_list_refuses_before_sending(d):
    app, c, fake, *_ = d
    connect(c)
    with app.state.db.connection(mode="read") as conn:
        for cmd in ("config/players/save", "auth/token/create", "players/cmd/volume_set", "player_queues/play_media", "music/favorites/add_item"):
            with pytest.raises(ma_direct.CommandRefused):
                ma_direct.call(conn, cmd, {})
    assert fake.calls == []


# ------------------------------------------------------------------------------------------------ caps and fallback


def test_without_the_direct_connection_the_panel_keeps_the_ha_depth(d):
    app, c, fake, bridge, keys, *_ = d
    dev = c.get(f"{API}/devices/{keys['a']}").json()
    assert (dev["caps"]["queue_list"], dev["caps"]["search"], dev["caps"]["browse"]) == (False, False, True)
    assert dev["can"]["queue"] is False and dev["can"]["browse"] is True
    assert c.get(f"{API}/devices/{keys['a']}/queue").json()["code"] == "ma_unavailable"
    assert c.get(f"{API}/devices/{keys['a']}/up-next").json()["confirmed"] is True, "up next is untouched"
    r = c.get(f"{API}/devices/{keys['a']}/browse?type=track&q=x")
    assert (r.status_code, r.json()["code"], r.json()["details"]["reason"]) == (422, "not_supported", "search")
    assert fake.calls == []


def test_with_the_direct_connection_the_caps_open_and_a_cast_speaker_stays_without(d):
    app, c, fake, bridge, keys, settings, _ = d
    connect(c)
    dev = c.get(f"{API}/devices/{keys['a']}").json()
    assert (dev["caps"]["queue_list"], dev["caps"]["search"], dev["caps"]["browse"], dev["can"]["queue"], dev["can"]["browse"]) == (True, True, True, True, True)
    garden = c.get(f"{API}/devices/{keys['garden']}").json()
    assert (garden["caps"]["queue_list"], garden["caps"]["browse"], garden["can"]["queue"]) == (False, False, False)
    bind(c, settings, "olga", "operator", "installation", "*")
    op = c.get(f"{API}/devices/{keys['a']}", headers=as_user("olga")).json()
    assert op["can"]["queue"] is True and op["can"]["browse"] is True, "an operator may edit the queue (owner 2026-10-02: whoever controls multimedia controls the music)"
    fake.fail = "unreachable"
    c.post(f"{API}/admin/ma-connection/test")
    assert c.get(f"{API}/devices/{keys['a']}").json()["caps"]["queue_list"] is False, "an unreachable server closes the full queue (the circuit)"


# ------------------------------------------------------------------------------------------------ the queue list


def test_the_queue_list_starts_at_the_current_item_marks_locked_rows_and_carries_no_id(d):
    app, c, fake, bridge, keys, *_ = d
    connect(c)
    r = c.get(f"{API}/devices/{keys['a']}/queue")
    assert r.status_code == 200, r.text
    q = r.json()
    assert (q["confirmed"], q["count"], q["index"], q["locked_to"], q["offset"]) == (True, 8, 2, 3, 2)
    assert [(i["index"], i["name"], i["locked"]) for i in q["items"]] == [(2, "שיר 2", True), (3, "שיר 3", True), (4, "שיר 4", False), (5, "שיר 5", False), (6, "שיר 6", False), (7, "שיר 7", False)]
    assert q["items"][0]["artist"] == "אמן" and q["items"][0]["album"] == "אלבום" and q["items"][0]["duration_s"] == 182
    text = json.dumps(q)
    assert "qi-" not in text and "q-" + aseed.UID_A not in text and "secret queue name" not in text and aseed.UID_A not in text
    assert all(len(i["item"]) == 24 for i in q["items"])
    assert ("player_queues/get_active_queue", {"player_id": aseed.UID_A}) in fake.calls, "the player id is the MA entity's unique_id, derived on the server"


def test_a_member_reads_its_leaders_queue_and_a_failed_read_is_unconfirmed(d):
    app, c, fake, bridge, keys, *_ = d
    connect(c)
    aseed.set_state(c, "media_player.ma_a", "playing", group_members=["media_player.ma_a", "media_player.ma_b"])
    aseed.set_state(c, "media_player.ma_b", "idle", active_queue=aseed.UID_A)
    c.get(f"{API}/devices/{keys['b']}/queue")
    assert [a["player_id"] for cmd, a in fake.calls if cmd == "player_queues/get_active_queue"] == [aseed.UID_A]
    ma_direct._QUEUES.clear()
    fake.fail = "refused"
    fake.rows = []

    def boom(*_a, **_k):
        raise ma_direct.MaError("error")

    fake.call = boom  # type: ignore[method-assign]
    q = c.get(f"{API}/devices/{keys['a']}/queue").json()
    assert q["confirmed"] is False and q["items"] == [] and q["count"] is None, "never an empty queue that is not one"


# ------------------------------------------------------------------------------------------------ edits


def _rows(c, keys) -> dict[str, str]:
    media_commands.BUCKETS.clear()  # the edits of one test are not a burst
    return {i["name"]: i["item"] for i in c.get(f"{API}/devices/{keys['a']}/queue").json()["items"]}


def test_move_next_and_delete_send_one_ma_command_each(d):
    app, c, fake, bridge, keys, *_ = d
    connect(c)
    items = _rows(c, keys)
    r = c.post(f"{API}/devices/{keys['a']}/queue", json=body(op="move", item=items["שיר 6"], to=4))
    assert (r.status_code, r.json()) == (202, {"status": "accepted", "op": "move", "to": 4}), r.text
    assert ("player_queues/move_item", {"queue_id": f"q-{aseed.UID_A}", "queue_item_id": "qi-6", "pos_shift": -2}) in fake.calls
    assert [r_["queue_item_id"] for r_ in fake.rows][4] == "qi-6"
    items = _rows(c, keys)
    r = c.post(f"{API}/devices/{keys['a']}/queue", json=body(op="next", item=items["שיר 7"]))
    assert r.status_code == 202 and r.json()["to"] == 4 and [r_["queue_item_id"] for r_ in fake.rows][4] == "qi-7", "play next = right after the locked rows"
    items = _rows(c, keys)
    r = c.post(f"{API}/devices/{keys['a']}/queue", json=body(op="delete", item=items["שיר 5"]))
    assert r.status_code == 202 and "qi-5" not in [r_["queue_item_id"] for r_ in fake.rows]
    rows = audit_rows(app, "media.queue")
    assert [(x["details"]["op"], x["decision"]) for x in rows] == [("move", "allowed"), ("next", "allowed"), ("delete", "allowed")]
    assert "שיר" not in json.dumps(rows) and "qi-" not in json.dumps(rows), "never an item name or id in the audit"


def test_locked_rows_unknown_items_bad_positions_and_queue_changes_are_refused(d):
    app, c, fake, bridge, keys, *_ = d
    connect(c)
    items = _rows(c, keys)
    for name in ("שיר 2", "שיר 3"):
        media_commands.BUCKETS.clear()
        r = c.post(f"{API}/devices/{keys['a']}/queue", json=body(op="delete", item=items[name]))
        assert (r.status_code, r.json()["code"]) == (409, "locked"), name
    media_commands.BUCKETS.clear()
    r = c.post(f"{API}/devices/{keys['a']}/queue", json=body(op="move", item=items["שיר 6"], to=3))
    assert (r.status_code, r.json()["code"]) == (422, "validation"), "nothing moves into the locked zone"
    r = c.post(f"{API}/devices/{keys['a']}/queue", json=body(op="move", item=items["שיר 6"], to=True))
    assert r.status_code == 422
    assert c.post(f"{API}/devices/{keys['a']}/queue", json=body(op="delete", item="0" * 24)).json()["code"] == "unknown_item"
    assert c.post(f"{API}/devices/{keys['b']}/queue", json=body(op="delete", item=items["שיר 6"])).json()["code"] == "unknown_item", "a row is the listed device's only"
    fake.rows = [r_ for r_ in fake.rows if r_["queue_item_id"] != "qi-6"]
    assert c.post(f"{API}/devices/{keys['a']}/queue", json=body(op="delete", item=items["שיר 6"])).json()["code"] == "queue_changed"
    assert not [x for x in fake.calls if x[0] in ("player_queues/move_item", "player_queues/delete_item")]
    assert {x["reason"] for x in audit_rows(app, "media.queue")} >= {"locked", "validation", "unknown_item", "queue_changed"}


def test_clear_asks_once_then_clears(d):
    app, c, fake, bridge, keys, *_ = d
    connect(c)
    r = c.post(f"{API}/devices/{keys['a']}/queue", json=body(op="clear"))
    assert (r.status_code, r.json()["code"], r.json()["details"]["count"]) == (409, "confirm_required", 4)
    assert not [x for x in fake.calls if x[0] == "player_queues/clear"]
    r = c.post(f"{API}/devices/{keys['a']}/queue", json=body(op="clear", confirmed=True))
    assert r.status_code == 202 and [x for x in fake.calls if x[0] == "player_queues/clear"] == [("player_queues/clear", {"queue_id": f"q-{aseed.UID_A}"})]


def test_queue_editing_needs_media_queue_default_deny_and_the_followers_anchors(d):
    app, c, fake, bridge, keys, settings, _ = d
    connect(c)
    items = _rows(c, keys)
    nq = c.post("/api/v1/access/roles", json={"name": "בלי תור", "permissions": ["media.read", "media.control"]})
    assert nq.status_code in (200, 201), nq.text
    bind(c, settings, "olga", nq.json()["id"], "installation", "*")
    r = c.post(f"{API}/devices/{keys['a']}/queue", headers=as_user("olga"), json=body(op="delete", item=items["שיר 6"]))
    assert r.status_code == 403
    assert c.get(f"{API}/devices/{keys['a']}/queue", headers=as_user("olga")).status_code == 200, "reading the full queue is media.read"
    assert not [x for x in fake.calls if x[0] == "player_queues/delete_item"]
    assert [x["decision"] for x in audit_rows(app, "media.queue")] == [] or all(x["decision"] == "denied" for x in audit_rows(app, "media.queue"))
    # a custom role that adds media.queue may edit
    role = c.post("/api/v1/access/roles", json={"name": "תור", "permissions": ["media.read", "media.control", "media.queue"]})
    assert role.status_code in (200, 201), role.text
    bind(c, settings, "quinn", role.json()["id"], "installation", "*")
    items = {i["name"]: i["item"] for i in c.get(f"{API}/devices/{keys['a']}/queue", headers=as_user("quinn")).json()["items"]}
    r = c.post(f"{API}/devices/{keys['a']}/queue", headers=as_user("quinn"), json=body(op="delete", item=items["שיר 6"]))
    assert r.status_code == 202, r.text


def test_a_refused_edit_says_mas_code_only_and_nothing_is_retried(d):
    app, c, fake, bridge, keys, *_ = d
    connect(c)
    items = _rows(c, keys)
    fake.fail = "refused"
    b = body(op="delete", item=items["שיר 6"])
    r = c.post(f"{API}/devices/{keys['a']}/queue", json=b)
    assert (r.status_code, r.json()) == (200, {"status": "refused", "op": "delete", "error": 11})
    n = len([x for x in fake.calls if x[0] == "player_queues/delete_item"])
    assert n == 1
    again = c.post(f"{API}/devices/{keys['a']}/queue", json=b)
    assert again.json() == r.json() and len([x for x in fake.calls if x[0] == "player_queues/delete_item"]) == 1, "the same request id is answered from memory"


def test_an_unreachable_server_opens_the_circuit_and_a_write_is_sent_once(d, caplog):
    app, c, fake, bridge, keys, *_ = d
    connect(c)
    items = _rows(c, keys)
    original = fake.call

    def flaky(url, token, command, args):
        if command == "player_queues/move_item":
            fake.calls.append((command, args))
            raise ma_direct.MaError("unreachable")
        return original(url, token, command, args)

    fake.call = flaky  # type: ignore[method-assign]
    with caplog.at_level(logging.DEBUG):
        r = c.post(f"{API}/devices/{keys['a']}/queue", json=body(op="move", item=items["שיר 6"], to=4))
    assert (r.status_code, r.json()["code"]) == (503, "ma_unavailable")
    assert len([x for x in fake.calls if x[0] == "player_queues/move_item"]) == 1, "never retried"
    n = len(fake.calls)
    assert c.get(f"{API}/devices/{keys['a']}/queue").json()["code"] == "ma_unavailable" and len(fake.calls) == n, "nothing is sent while the circuit is open"
    assert TOKEN not in caplog.text and "ma.example" not in caplog.text


def test_queue_edits_are_rate_limited_per_device(d, monkeypatch):
    app, c, fake, bridge, keys, *_ = d
    monkeypatch.setattr(media_queue, "EDIT_DEVICE", (2.0, 4.0))
    connect(c)
    items = _rows(c, keys)
    codes = [c.post(f"{API}/devices/{keys['a']}/queue", json=body(op="move", item=items["שיר 6"], to=5)).status_code for _ in range(6)]
    assert 429 in codes


def test_an_expired_or_malformed_edit_is_refused_before_anything_is_sent(d):
    app, c, fake, bridge, keys, *_ = d
    connect(c)
    items = _rows(c, keys)
    n = len(fake.calls)
    r = c.post(f"{API}/devices/{keys['a']}/queue", json=body(op="delete", item=items["שיר 6"], expires_at="2020-01-01T00:00:00Z"))
    assert (r.status_code, r.json()["code"]) == (409, "expired")
    assert c.post(f"{API}/devices/{keys['a']}/queue", json=body(op="shuffle")).status_code == 422
    assert c.post(f"{API}/devices/{keys['a']}/queue", json=body(op="delete", item=items["שיר 6"], uri="library://x")).status_code == 422
    assert len(fake.calls) == n


# ------------------------------------------------------------------------------------------------ the library tab


def test_browse_goes_through_the_bridge_paged_and_lists_only_playable_refs(d):
    app, c, fake, bridge, keys, settings, calls = d
    r = c.get(f"{API}/devices/{keys['a']}/browse?type=album&offset=50")
    assert r.status_code == 200, r.text
    page = r.json()
    assert [i["name"] for i in page["items"]] == ["פריט 50", "פריט 51", "פריט 52"] and page["more"] is False and page["q"] is None
    assert "library://" not in json.dumps(page) and "file:" not in json.dumps(page)
    (req,) = bridge.requests
    assert (req["query"], req["media_type"], req["favorite"], req["offset"], req["limit"]) == ("library", "album", False, 50, 50)
    assert fake.calls == [], "browsing needs no direct connection"
    # a browsed item is started with the ordinary play_item command (Music Assistant through the bridge)
    r = mseed.send(c, keys["a"], "play_item", item_ref=page["items"][0]["item_ref"], enqueue="next")
    assert r.status_code == 202, r.text
    assert [(x["service"], x["data"]["media_id"], x["data"]["enqueue"]) for x in calls if x["service"] == "play_media"] == [("play_media", "library://album/50", "next")]


def test_search_goes_through_the_direct_connection_and_drops_urls_and_other_types(d):
    app, c, fake, bridge, keys, *_ = d
    connect(c)
    r = c.get(f"{API}/devices/{keys['a']}/browse?type=track&q=נמ")
    assert r.status_code == 200, r.text
    assert [i["name"] for i in r.json()["items"]] == ["נמצא"] and r.json()["items"][0]["artist"] == "אמנית"
    assert ("music/search", {"search_query": "נמ", "media_types": ["track"], "limit": 50, "library_only": True}) in fake.calls
    assert bridge.requests == []
    assert c.get(f"{API}/devices/{keys['a']}/browse?type=podcast").status_code == 422
    assert c.get(f"{API}/devices/{keys['a']}/browse?type=track&q=" + "x" * 61).status_code == 422


def announce(c: TestClient, version: str) -> None:
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    assert c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": version})).status_code == 200


def test_search_without_the_direct_connection_goes_through_a_bridge_of_0_7_0(d):
    app, c, fake, bridge, keys, *_ = d
    announce(c, "0.7.0")
    dev = c.get(f"{API}/devices/{keys['a']}").json()
    assert (dev["caps"]["search"], dev["caps"]["queue_list"], dev["caps"]["browse"]) == (True, False, True), "search opens; the full queue still needs the direct connection"
    r = c.get(f"{API}/devices/{keys['a']}/browse?type=album&q=  נמצא ")
    assert r.status_code == 200, r.text
    assert [i["name"] for i in r.json()["items"]] == ["נמצא בגשר"], "a URL and another type are dropped here too"
    assert "http" not in r.text and "library://" not in r.text, "items travel as opaque refs"
    (req,) = [x for x in bridge.requests if x["query"] == "search"]
    assert (req["media_type"], req["name"], req["limit"], req["entity_id"]) == ("album", "נמצא", 50, "media_player.ma_a") and "config_entry_id" not in req
    assert fake.calls == [], "the direct connection was never asked"
    again = c.get(f"{API}/devices/{keys['a']}/browse?type=album&q=נמצא")
    assert again.status_code == 200 and len([x for x in bridge.requests if x["query"] == "search"]) == 1, "a repeat inside a minute is served from the cache"


def test_search_through_the_bridge_needs_0_7_0_and_reports_a_refusal_as_unavailable(d):
    app, c, fake, bridge, keys, *_ = d
    assert c.get(f"{API}/devices/{keys['a']}").json()["caps"]["search"] is False, "bridge 0.5.0: no search"
    announce(c, "0.7.0")
    bridge.search_error = "no_library"
    r = c.get(f"{API}/devices/{keys['a']}/browse?type=track&q=x")
    assert (r.status_code, r.json()["code"]) == (503, "search_unavailable")
    assert "http" not in r.text
    garden = c.get(f"{API}/devices/{keys['garden']}").json()
    assert garden["caps"]["search"] is False, "a Cast speaker has no Music Assistant library"


def test_the_direct_connection_still_wins_over_the_bridge_when_both_are_there(d):
    app, c, fake, bridge, keys, *_ = d
    announce(c, "0.7.0")
    connect(c)
    r = c.get(f"{API}/devices/{keys['a']}/browse?type=track&q=נמ")
    assert r.status_code == 200 and [i["name"] for i in r.json()["items"]] == ["נמצא"]
    assert [x for x in bridge.requests if x["query"] == "search"] == [] and ("music/search", {"search_query": "נמ", "media_types": ["track"], "limit": 50, "library_only": True}) in fake.calls


def test_browse_needs_media_browse(d):
    app, c, fake, bridge, keys, settings, _ = d
    bind(c, settings, "vera", "viewer", "installation", "*")
    r = c.get(f"{API}/devices/{keys['a']}/browse?type=track", headers=as_user("vera"))
    assert r.status_code == 403 and bridge.requests == []
    bind(c, settings, "olga", "operator", "installation", "*")
    assert c.get(f"{API}/devices/{keys['a']}/browse?type=track", headers=as_user("olga")).status_code == 200


def _search_requests(bridge) -> list[dict[str, Any]]:
    return [x for x in bridge.requests if x["query"] == "search"]


def test_a_bridge_search_is_cached_per_user_so_user_b_never_gets_user_as_answer(d):
    app, c, fake, bridge, keys, settings, _ = d
    announce(c, "0.7.0")
    bind(c, settings, "olga", "operator", "installation", "*")
    bind(c, settings, "vera", "operator", "installation", "*")
    url = f"{API}/devices/{keys['a']}/browse?type=album&q=נמצא"
    assert c.get(url, headers=as_user("olga")).status_code == 200
    assert c.get(url, headers=as_user("olga")).status_code == 200
    assert len(_search_requests(bridge)) == 1, "the same user is served from the cache"
    assert c.get(url, headers=as_user("vera")).status_code == 200
    users = {x["user_id"] for x in _search_requests(bridge)}
    assert len(_search_requests(bridge)) == 2 and len(users) == 2, "another user is asked again: the bridge checks identity, the HA user and the rate limit per caller"


def test_the_bridge_search_limit_never_exceeds_the_bridges_cap_even_if_the_page_size_grows(d, monkeypatch):
    app, c, fake, bridge, keys, *_ = d
    from bridge_loader import load

    policy = load("media_policy")
    assert media_queue.BRIDGE_SEARCH_LIMIT_MAX == policy.SEARCH_LIMIT_MAX
    announce(c, "0.7.0")
    monkeypatch.setattr(media_queue, "BROWSE_PAGE", 120)
    r = c.get(f"{API}/devices/{keys['a']}/browse?type=album&q=נמצא")
    assert r.status_code == 200, r.text
    (req,) = _search_requests(bridge)
    assert req["limit"] == policy.SEARCH_LIMIT_MAX
    assert policy.query_refusal("search", {k: req[k] for k in ("entity_id", "media_type", "name", "limit")}) is None, "the bridge would have refused it"


@pytest.mark.parametrize("error,status,code", [("rate_limited", 429, "rate_limited"), ("unknown_user", 403, "forbidden"), ("no_library", 503, "search_unavailable"), ("TimeoutError", 503, "search_unavailable")])
def test_bridge_refusal_codes_map_to_http_statuses_and_keep_the_original_in_error(d, error, status, code):
    app, c, fake, bridge, keys, *_ = d
    announce(c, "0.7.0")
    bridge.search_error = error
    r = c.get(f"{API}/devices/{keys['a']}/browse?type=track&q=x")
    assert (r.status_code, r.json()["code"], r.json()["details"]["error"]) == (status, code, error), r.text
    assert "http" not in r.text


def test_a_bridge_refusal_on_browse_maps_the_same_way(d, monkeypatch):
    app, c, fake, bridge, keys, *_ = d
    announce(c, "0.7.0")

    def refuse(_s, payload, timeout=15.0):
        return {"ok": False, "request_id": payload["request_id"], "query": payload["query"], "error": "rate_limited"}

    monkeypatch.setattr(media_query, "call_bridge_media_query", refuse)
    r = c.get(f"{API}/devices/{keys['a']}/browse?type=track")
    assert (r.status_code, r.json()["code"], r.json()["details"]["error"]) == (429, "rate_limited", "rate_limited")


def test_a_user_without_media_browse_gets_403_on_a_bridge_search_and_the_bridge_is_never_asked(d):
    app, c, fake, bridge, keys, settings, _ = d
    announce(c, "0.7.0")
    bind(c, settings, "vera", "viewer", "installation", "*")
    r = c.get(f"{API}/devices/{keys['a']}/browse?type=track&q=x", headers=as_user("vera"))
    assert r.status_code == 403 and bridge.requests == []


def test_bridge_search_ready_follows_the_announced_version_and_a_downgrade(d):
    import sqlite3

    from smplwise.services import media_store

    app, c, *_ = d

    def ready() -> bool:
        with app.state.db.connection(mode="read") as conn:
            return media_store.bridge_search_ready(conn)

    for version, want in (("0.6.9", False), ("0.7", True), ("0.7.0", True), ("0.10.0", True)):
        announce(c, version)
        assert ready() is want, version
    announce(c, "0.7.0")
    assert ready() is True
    announce(c, "0.6.9")
    assert ready() is False, "a downgrade after a signed ping closes search again"
    announce(c, "")
    assert ready() is False, "an empty version fails closed"
    mem = sqlite3.connect(":memory:")
    mem.execute("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)")
    mem.executemany("INSERT INTO settings VALUES (?, ?)", [("bridge.secret", "s"), ("bridge.paired_at", "2026-01-01T00:00:00Z")])
    assert media_store.bridge_search_ready(mem) is False, "no version row (None)"
    mem.execute("INSERT INTO settings VALUES ('bridge.integration_version', '0.7.0')")
    assert media_store.bridge_search_ready(mem) is True


# ------------------------------------------------------------------------------------------------ the real HTTP transport against the live fixture's fake MA server


def _fixture():
    import importlib.util
    import pathlib
    import sys

    path = pathlib.Path(__file__).resolve().parents[3] / "frontend" / "tests" / "fixtures" / "media_fake_ha.py"
    spec = importlib.util.spec_from_file_location("media_fake_ha_for_ma_direct", path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)  # no side effect on import
    return mod


def test_the_http_transport_speaks_json_rpc_to_the_fixtures_fake_server(settings, monkeypatch):
    import httpx

    fx = _fixture()
    fx.MODEL.load(fx.build_world("ma"))
    owner = next(k for k, q in fx.MODEL.queues.items() if len(q["items"]) >= 4)
    pid = fx.MODEL.ents[owner]["unique_id"]
    seen: list[tuple[str, str, str | None]] = []
    real = httpx.HTTPTransport.handle_request

    def handle(self, request):
        if request.url.host == fx.FAKE_MA_HOST:
            seen.append((request.method, request.url.path, request.headers.get("authorization")))
            if fx.MODEL.ma_down:
                raise httpx.ConnectError("down", request=request)
            status, answer = fx.ma_http(request.method, request.url.path, request.headers, request.content)
            return httpx.Response(status, json=answer, request=request)
        return real(self, request)

    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", handle)
    ma_direct.reset()
    app = create_app(settings)
    c = TestClient(app)
    assert c.put(f"{API}/admin/ma-connection", json={"enabled": True, "url": f"http://{fx.FAKE_MA_HOST}:8095", "token": fx.FAKE_MA_TOKEN}).status_code == 200
    out = c.post(f"{API}/admin/ma-connection/test").json()
    assert out["state"] == "ready" and out["schema_version"] == fx.FAKE_MA_SCHEMA and out["players"] >= 1
    assert seen[0] == ("GET", "/info", None), "the server description is read without the token"
    assert all(a == f"Bearer {fx.FAKE_MA_TOKEN}" for m, p, a in seen if p == "/api")
    with app.state.db.connection(mode="read") as conn:
        h = ma_direct.header(conn, pid, fresh=True)
        rows = ma_direct.items(conn, h["queue_id"], 0, 50)
        assert h["count"] == len(rows) and rows[0]["name"]
        last = rows[-1]
        ma_direct.call(conn, "player_queues/move_item", {"queue_id": h["queue_id"], "queue_item_id": last["queue_item_id"], "pos_shift": -(len(rows) - 1 - (h["index"] + 1))})
        again = ma_direct.items(conn, h["queue_id"], 0, 50)
        assert again[h["index"] + 1]["queue_item_id"] == last["queue_item_id"], "the fake server moved the row"
        with pytest.raises(ma_direct.MaError) as refused:
            ma_direct.call(conn, "player_queues/delete_item", {"queue_id": h["queue_id"], "item_id_or_index": again[h["index"]]["queue_item_id"]})
        assert (refused.value.state, refused.value.ma_code) == ("refused", 11), "MA's own code for the playing row"
        found = ma_direct.search(conn, "track", "a")
        assert all(i["media_type"] == "track" for i in found)
    # a wrong token is `unauthorized` (sticky until the settings change)
    assert c.put(f"{API}/admin/ma-connection", json={"token": "wrong-token-0123456789abcdef"}).status_code == 200
    assert c.post(f"{API}/admin/ma-connection/test").json()["state"] == "unauthorized"
    fx.MODEL.ma_down = True
    assert c.post(f"{API}/admin/ma-connection/test").json()["state"] == "unreachable"


def test_an_oversized_or_odd_answer_is_an_error_never_buffered_or_parsed_as_text(monkeypatch):
    import httpx

    def handle(self, request):
        if request.url.path == "/info":
            return httpx.Response(200, content=b"x" * (ma_direct.ANSWER_MAX + 10), request=request)
        if request.url.path == "/api":
            return httpx.Response(500, content=b"<html>secret detail</html>", request=request)
        raise AssertionError(request.url.path)

    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", handle)
    t = ma_direct.HttpTransport()
    with pytest.raises(ma_direct.MaError) as big:
        t.info("http://ma.example.test:8095")
    assert big.value.state == "error"
    with pytest.raises(ma_direct.MaError) as odd:
        t.call("http://ma.example.test:8095", TOKEN, "players/all", {})
    assert (odd.value.state, odd.value.ma_code) == ("error", None) and "secret" not in str(odd.value)


def test_the_new_permissions_have_labels_and_their_default_roles():
    from smplwise.rbac import ROLES
    from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE

    assert PERMISSION_LABELS["media.browse"] == "עיון וחיפוש בספריית המוזיקה" and PERMISSION_LABELS["media.queue"] == "עריכת תור הניגון"
    assert {r for r in ROLES if "media.browse" in ROLES[r]} == {"operator", "site_admin", "system_admin"}
    assert {r for r in ROLES if "media.queue" in ROLES[r]} == {"operator", "site_admin", "system_admin"}, "every built-in role that controls multimedia may edit the queue; viewers, kiosks and editors may not"
    assert "media.queue" not in SENSITIVE and "media.browse" not in SENSITIVE
    import pathlib

    contract = json.loads((pathlib.Path(__file__).resolve().parents[3] / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    assert {r["id"]: sorted(p for p in r["permissions"] if p in ("media.browse", "media.queue")) for r in contract["roles"]} == \
        {r["id"]: sorted(p for p in ROLES[r["id"]] if p in ("media.browse", "media.queue")) for r in contract["roles"]}
