"""CR-028 phase 1: cast sessions end to end against fakes - the synthetic media installation of media_seed (two Google Cast TVs), a
fake go2rtc behind the REAL relay listener on 127.0.0.1, and a fake bridge that runs the bridge's own cast_policy.py with the origin it
learned from the add-on's signed user-directory answer. A "TV" is an httpx client fetching the relay URL. No real device, recorder,
go2rtc or Home Assistant is contacted; every name, id and address is invented."""
from __future__ import annotations

import dataclasses
import datetime as dt
import json
import uuid

import bridge_loader
import httpx
import media_seed as seed
import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise import remote_channel
from smplwise.db import now_iso
from smplwise.main import create_app
from smplwise.services import cast_relay as cr
from smplwise.services import cast_sessions as cs
from smplwise.services import go2rtc as g2
from smplwise.services import ha_bridge, ha_client

API = "/api/v1/multimedia/cast"
policy = bridge_loader.load("cast_policy")
signing = bridge_loader.load("signing")
CAST_PLATFORM = {"media_player.tv_living_cast": "cast", "media_player.tv_bedroom_cast": "cast", "media_player.tv_living": "samsungtv_smart"}
MASTER = b"#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000\nhls/playlist.m3u8?id=Hs01\n"
MEDIA = b"#EXTM3U\n#EXT-X-TARGETDURATION:2\n#EXT-X-MAP:URI=\"init.mp4?id=Hs01\"\n#EXTINF:1.0,\nsegment.m4s?id=Hs01&n=1\n"


class Go2rtc:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, str]]] = []

    def __call__(self, path, params):
        self.calls.append((path, dict(params)))
        return {"/api/stream.m3u8": (200, MASTER), "/api/hls/playlist.m3u8": (200, MEDIA)}.get(path, (200, b"\x00\x00\x00\x18ftypmp42"))


class World:
    def __init__(self, settings, monkeypatch) -> None:
        self.settings = dataclasses.replace(settings, cast_relay=True, go2rtc_url="http://go2rtc.test")
        self.app = create_app(self.settings)
        self.c = TestClient(self.app)
        seed.install(self.c)
        seed.approve_all(self.c)
        self.living = seed.key_of(self.c, "media_player.tv_living")
        self.bedroom = seed.key_of(self.c, "media_player.tv_bedroom")
        from smplwise.services.autosync import DEFAULT_RECORDER, ensure_recorder

        with self.app.state.db.connection() as conn:
            ensure_recorder(conn)
            now = now_iso()
            for cid, ch, codec in (("cam1", 1, "H.264"), ("cam2", 2, "H.265")):
                caps = json.dumps({"encoding": {"main": {"codec": codec}, "sub": {"codec": "H.264"}}})
                conn.execute("INSERT INTO cameras(id, recorder_id, channel, name_source, sort_order, main_track, sub_track, capabilities_json, status, created_at, updated_at) "
                             "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'online', ?, ?)", (cid, DEFAULT_RECORDER, ch, f"מצלמה {ch}", ch, ch * 100 + 1, ch * 100 + 2, caps, now, now))
        self.go2rtc = Go2rtc()
        cr.SERVER.stop()
        assert cr.SERVER.start(self.go2rtc, host="127.0.0.1", port=0)
        self.origin = f"http://127.0.0.1:{cr.SERVER.port}"
        monkeypatch.setattr(cs, "ensure_stream", lambda s, cam, profile: g2.stream_name(cam["recorder_id"], cam["channel"], profile))
        monkeypatch.setattr(cs, "START_GAP_S", 0.0)
        cs._last_start.clear()
        self.secret = self.c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
        self.ping("0.7.0")
        self.bridge_origin: str | None = None
        self.calls: list[dict] = []
        self.answer: dict | None = None
        self.verifier = signing.Verifier(self.secret)

        def fake_bridge(_settings, payload, timeout=15.0):
            ha_bridge.verify(self.secret, payload)
            self.calls.append(payload)
            if self.answer is not None:
                return self.answer
            blocked = policy.refusal(payload, CAST_PLATFORM.get, self.bridge_origin, ["127.0.0.1"])
            return {"ok": blocked is None, "request_id": payload["request_id"], **({"error": blocked} if blocked else {})}

        monkeypatch.setattr(ha_client, "call_bridge_cast_stream", fake_bridge)

    def ping(self, version: str) -> None:
        assert self.c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(self.secret, {"version": version})).status_code == 200

    def directory(self) -> dict:
        """The integration's minute push; the bridge keeps the signed origin of the answer (cast_service.note_origin's rules)."""
        r = self.c.post("/api/v1/ha/bridge/directory", json=ha_bridge.sign(self.secret, {"users": [], "version": "0.7.0"}))
        assert r.status_code == 200, r.text
        block = r.json()["cast"]
        assert self.verifier.verify(dict(block)) is None
        self.bridge_origin = block["cast_origin"]
        return block

    def ready(self) -> None:
        assert self.c.put(f"{API}/config", json={"enabled": True, "origin": self.origin}).status_code == 200
        assert self.c.post(f"{API}/origin/check").json() == {"ok": True, "reason": None}
        self.directory()

    def allow(self, key: str, **fields) -> dict:
        r = self.c.put(f"{API}/screens/{key}", json={"allow": True, **fields})
        assert r.status_code == 200, r.text
        return r.json()

    def start(self, key: str, camera: str = "cam1", headers=None, **fields):
        body = {"target_key": key, "camera_id": camera, "client_request_id": fields.pop("client_request_id", uuid.uuid4().hex), **fields}
        return self.c.post(f"{API}/sessions", json=body, headers=headers or {})

    def plays(self) -> list[dict]:
        return [p for p in self.calls if p["op"] == "play"]

    def audit(self, action: str) -> list[dict]:
        with self.app.state.db.connection(mode="read") as conn:
            rows = conn.execute("SELECT action, decision, reason, resource_id, details_json FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()
        return [{**dict(r), "details": json.loads(r["details_json"] or "{}")} for r in rows]

    def janitor(self) -> dict:
        return cs.janitor(self.app.state.db, self.settings)


@pytest.fixture()
def w(settings, monkeypatch):
    world = World(settings, monkeypatch)
    yield world
    cr.SERVER.stop()
    cr.INDEX.clear()


def code(r) -> str:
    return r.json().get("code")


# ------------------------------------------------------------------------------------------------ readiness and administration


def test_nothing_casts_until_the_relay_the_switch_and_the_verified_origin_are_all_there(w):
    cfg = w.c.get(f"{API}/config").json()
    assert cfg["config"]["enabled"] is False and cfg["ready"] is False and cfg["reason"] == "disabled"
    assert cfg["config"]["minutes"] == 30 and cfg["config"]["max_sessions"] == 2 and cfg["config"]["power_off_after"] is True and cfg["config"]["max_extensions"] == 8
    assert cfg["relay"] == {"option": True, "listening": True, "container_port": 18092, "error": None}
    assert w.directory()["cast_origin"] is None, "the bridge is told no origin while casting is not ready"
    w.allow(w.living)
    assert (r := w.start(w.living)).status_code == 409 and r.json()["details"]["reason"] == "disabled"
    w.c.put(f"{API}/config", json={"enabled": True})
    assert w.start(w.living).json()["details"]["reason"] == "origin_missing"
    w.c.put(f"{API}/config", json={"origin": w.origin})
    assert w.start(w.living).json()["details"]["reason"] == "origin_unverified"
    assert w.c.post(f"{API}/origin/check").json()["ok"] is True
    assert w.directory()["cast_origin"] == w.origin
    assert w.c.get(f"{API}/config").json()["ready"] is True
    w.c.put(f"{API}/config", json={"origin": "http://127.0.0.2:1"})
    assert w.c.get(f"{API}/config").json()["reason"] == "origin_unverified", "a new origin must be checked again"
    assert w.calls == []
    assert [r["reason"] for r in w.audit("media.cast.denied")] == ["cast_unavailable"] * 3


@pytest.mark.parametrize("origin", ["https://192.168.1.5:18092", "http://ha.local:18092", "http://8.8.8.8:18092", "http://192.168.1.5", "http://u:p@192.168.1.5:1/",
                                    "http://192.168.1.5:18092/x", "http://169.254.1.1:18092", "http://0.0.0.0:18092"])
def test_the_origin_must_be_a_lan_ip_with_a_port(w, origin):
    r = w.c.put(f"{API}/config", json={"origin": origin})
    assert r.status_code == 422 and code(r) in ("origin_invalid", "origin_not_ip", "origin_not_lan")


def test_the_config_audit_never_carries_the_origin_address(w):
    w.ready()
    rows = w.audit("media.cast.config")
    assert rows and all("127.0.0.1" not in json.dumps(r) for r in rows)


def test_casting_is_off_per_screen_until_the_administrator_allows_it(w):
    w.ready()
    r = w.start(w.living)
    assert (r.status_code, code(r)) == (403, "cast_not_allowed")
    screens = {s["key"]: s for s in w.c.get(f"{API}/screens").json()["screens"]}
    assert screens[w.living]["settings"] == {"allow": False, "method": "auto", "minutes": None, "permanent": False, "allow_main": None}
    assert screens[w.living]["effective"]["method"] == "cast_hls" and screens[w.living]["target_entity_id"] == "media_player.tv_living_cast"
    w.allow(w.living)
    assert w.start(w.living).status_code == 202
    assert w.audit("media.cast.screen")[0]["details"] == {"changed": ["allow"], "allow": True}


def test_the_method_override_none_takes_a_screen_out(w):
    w.ready()
    w.allow(w.living, method="none")
    r = w.start(w.living)
    assert (r.status_code, code(r)) == (409, "cast_unsupported")


# ------------------------------------------------------------------------------------------------ the whole chain


def test_start_play_on_the_tv_then_stop_the_token_dies(w):
    w.ready()
    w.allow(w.living)
    r = w.start(w.living)
    assert r.status_code == 202, r.text
    s = r.json()["session"]
    assert s["state"] == "starting" and s["profile"] == "sub" and s["camera_name"] == "מצלמה 1" and s["can"] == {"stop": True, "extend": True, "switch": True}
    (play,) = w.plays()
    assert play["entity_id"] == "media_player.tv_living_cast" and play["title"] == "מצלמה 1" and play["url"].startswith(w.origin + "/cast/")
    url = play["url"]
    token = url.split("/")[4]
    # the TV pulls on the LAN: master, media playlist, init, first segment -> "playing" (the honest signal)
    tv = httpx.Client(timeout=5)
    assert tv.get(url).status_code == 200
    assert w.go2rtc.calls[0] == ("/api/stream.m3u8", {"src": "smplwise_nvr-1_ch1_sub", "mp4": ""})
    base = url.rsplit("/", 1)[0]
    assert tv.get(f"{base}/hls/playlist.m3u8?id=Hs01").status_code == 200
    assert tv.get(f"{base}/hls/init.mp4?id=Hs01").status_code == 200
    assert w.c.get(f"{API}/sessions/{s['session_id']}").json()["state"] == "starting"
    assert tv.get(f"{base}/hls/segment.m4s?id=Hs01&n=1").status_code == 200
    assert w.c.get(f"{API}/sessions/{s['session_id']}").json()["state"] == "playing"
    # stop: one `stop`, the token revoked, no power-off (the screen was on before)
    r = w.c.delete(f"{API}/sessions/{s['session_id']}")
    assert r.status_code == 200 and r.json()["stop"] == "sent" and r.json()["power_off"] is None
    assert [p["op"] for p in w.calls] == ["play", "stop"]
    assert tv.get(url).status_code == 403
    assert w.c.get(f"{API}/sessions").json()["sessions"] == []
    st = w.c.get(f"{API}/sessions/{s['session_id']}").json()
    assert (st["state"], st["stop_reason"]) == ("stopped", "user")
    # nothing of the token, the URL or the origin's address in the audit rows
    with w.app.state.db.connection(mode="read") as conn:
        dump = json.dumps([dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action LIKE 'media.cast.%'").fetchall()], ensure_ascii=False)
        assert token not in dump and url not in dump and str(cr.SERVER.port) not in dump
        row = conn.execute("SELECT * FROM cast_sessions WHERE session_id = ?", (s["session_id"],)).fetchone()
        assert token not in json.dumps(dict(row)) and row["token_hash"] == cr.token_hash(token)
    start_row = w.audit("media.cast.start")[0]
    assert start_row["details"]["stream"] == "smplwise_nvr-1_ch1_sub" and start_row["details"]["camera_id"] == "cam1" and start_row["details"]["ha_action_id"]


def test_the_bridge_refuses_a_url_off_its_announced_origin(w):
    """The add-on and the bridge disagree (the origin changed in the add-on after the last directory push): the bridge's own check wins."""
    w.ready()
    w.allow(w.living)
    w.bridge_origin = "http://127.0.0.1:1"
    r = w.start(w.living)
    assert r.status_code == 200 and r.json()["status"] == "refused" and r.json()["error"] == "cast_origin_mismatch"
    assert r.json()["session"]["stop_reason"] == "refused"
    assert httpx.get(w.plays()[0]["url"], timeout=5).status_code == 403, "a refused start leaves no live token"
    assert w.audit("media.cast.start")[0]["decision"] == "denied"


def test_home_assistant_unreachable_ends_the_session_and_answers_503(w, monkeypatch):
    w.ready()
    w.allow(w.living)
    from smplwise.errors import ApiError

    def down(*a, **k):
        raise ApiError(503, "ha_unavailable", "x")

    monkeypatch.setattr(ha_client, "call_bridge_cast_stream", down)
    r = w.start(w.living)
    assert (r.status_code, code(r)) == (503, "ha_unavailable")
    assert w.c.get(f"{API}/sessions").json()["sessions"] == []


def test_the_same_client_request_never_starts_twice(w):
    w.ready()
    w.allow(w.living)
    a = w.start(w.living, client_request_id="req-000000001")
    b = w.start(w.living, client_request_id="req-000000001")
    assert (a.status_code, b.status_code) == (202, 200) and b.json()["status"] == "existing"
    assert a.json()["session"]["session_id"] == b.json()["session"]["session_id"] and len(w.plays()) == 1


# ------------------------------------------------------------------------------------------------ permissions and the picker


def test_permissions_media_cast_video_live_and_scope(w, settings):
    w.ready()
    w.allow(w.living)
    bind(w.c, w.settings, "vera", "viewer", "installation", "*")
    bind(w.c, w.settings, "olga", "operator", "installation", "*")
    r = w.start(w.living, headers=as_user("vera"))
    assert (r.status_code, code(r)) == (403, "forbidden")
    assert w.c.get(f"{API}/targets", headers=as_user("vera")).status_code == 403
    r = w.start(w.living, headers=as_user("olga"))
    assert r.status_code == 202, r.text
    sid = r.json()["session"]["session_id"]
    # the viewer sees the cast on a screen of their scope (media.read), but may not stop it
    seen = w.c.get(f"{API}/sessions", headers=as_user("vera")).json()["sessions"]
    assert [x["session_id"] for x in seen] == [sid] and seen[0]["can"]["stop"] is False and seen[0]["mine"] is False
    assert w.c.delete(f"{API}/sessions/{sid}", headers=as_user("vera")).status_code == 403
    # an unknown camera, a camera the operator may not watch
    assert w.start(w.bedroom, camera="nope", headers=as_user("olga")).status_code in (403, 404)
    denied = w.audit("media.cast.denied")
    assert denied[0]["reason"] == "forbidden" and denied[0]["resource_id"] == w.living
    # the administrator stops anyone's cast: reason admin
    r = w.c.delete(f"{API}/sessions/{sid}")
    assert r.json()["session"]["stop_reason"] == "admin"


def test_the_picker_lists_screens_with_state_and_the_blocked_display_setting(w):
    w.ready()
    w.allow(w.living)
    bind(w.c, w.settings, "olga", "operator", "installation", "*")
    t = w.c.get(f"{API}/targets", params={"camera": "cam1"}, headers=as_user("olga")).json()
    rows = {x["key"]: x for x in t["targets"]}
    assert t["ready"] is True and rows[w.living]["blocked"] is None and rows[w.living]["state"] == "free"
    assert rows[w.bedroom]["blocked"] == "not_allowed", "grey with the reason by default (owner decision Q4)"
    assert all(x["key"] in (w.living, w.bedroom) for x in t["targets"]), "a screen without a cast path is never a target"
    w.c.put(f"{API}/config", json={"blocked_display": "hide"})
    assert [x["key"] for x in w.c.get(f"{API}/targets", headers=as_user("olga")).json()["targets"]] == [w.living]
    w.c.put(f"{API}/config", json={"blocked_display": "grey_admin"})
    assert [x["key"] for x in w.c.get(f"{API}/targets", headers=as_user("olga")).json()["targets"]] == [w.living]
    assert {x["key"] for x in w.c.get(f"{API}/targets").json()["targets"]} == {w.living, w.bedroom}
    sid = w.start(w.living).json()["session"]["session_id"]
    rows = {x["key"]: x for x in w.c.get(f"{API}/targets").json()["targets"]}
    assert rows[w.living]["state"] == "casting" and rows[w.living]["casting_session_id"] == sid


def test_a_public_screen_needs_media_public(w):
    w.ready()
    w.allow(w.living)
    assert w.c.put(f"/api/v1/multimedia/admin/devices/{w.living}", json={"public": True}).status_code == 200
    bind(w.c, w.settings, "olga", "operator", "installation", "*")
    r = w.start(w.living, headers=as_user("olga"))
    assert (r.status_code, code(r)) == (403, "public_screen")
    assert w.start(w.living).status_code == 202


def test_the_administrator_test_cast_is_60_seconds_even_before_the_screen_is_allowed(w):
    w.ready()
    bind(w.c, w.settings, "olga", "operator", "installation", "*")
    assert w.c.post(f"{API}/test", json={"target_key": w.living, "camera_id": "cam1"}, headers=as_user("olga")).status_code == 403
    r = w.c.post(f"{API}/test", json={"target_key": w.living, "camera_id": "cam1"})
    assert r.status_code == 202, r.text
    s = r.json()["session"]
    started, expires = (dt.datetime.fromisoformat(s[k].replace("Z", "+00:00")) for k in ("started_at", "expires_at"))
    assert s["kind"] == "test" and 59 <= (expires - started).total_seconds() <= 61 and s["can"]["extend"] is False
    assert w.c.post(f"{API}/sessions/{s['session_id']}/extend").status_code == 409
    assert w.audit("media.cast.test")[0]["details"]["kind"] == "test"


def test_the_administration_is_local_only_and_the_press_works_remotely():
    blocked = remote_channel.BLOCKED_ON_REMOTE
    for path in ("/api/v1/multimedia/cast/config", "/api/v1/multimedia/cast/origin", "/api/v1/multimedia/cast/screens", "/api/v1/multimedia/cast/test"):
        assert path in blocked
    assert not any(p.startswith("/api/v1/multimedia/cast/sessions") or p == "/api/v1/multimedia/cast/targets" for p in blocked)


# ------------------------------------------------------------------------------------------------ lifecycle


def test_replace_on_the_same_screen_and_the_installation_cap(w):
    w.ready()
    w.allow(w.living)
    w.allow(w.bedroom)
    w.c.put(f"{API}/config", json={"max_sessions": 1})
    first = w.start(w.living).json()["session"]
    old_url = w.plays()[0]["url"]
    r = w.start(w.bedroom)
    assert (r.status_code, code(r)) == (409, "cast_limit") and r.json()["details"]["max"] == 1
    second = w.start(w.living, camera="cam2").json()["session"]
    assert w.c.get(f"{API}/sessions/{first['session_id']}").json()["stop_reason"] == "replaced"
    assert httpx.get(old_url, timeout=5).status_code == 403
    assert [x["session_id"] for x in w.c.get(f"{API}/sessions").json()["sessions"]] == [second["session_id"]]
    assert [p["op"] for p in w.calls] == ["play", "play"], "a replaced cast is not stopped: the new play takes the screen"
    assert w.audit("media.cast.stop")[0]["details"]["replaced_by"] == second["session_id"]


def test_one_start_per_screen_per_five_seconds(w, monkeypatch):
    w.ready()
    w.allow(w.living)
    monkeypatch.setattr(cs, "START_GAP_S", 5.0)
    assert w.start(w.living).status_code == 202
    r = w.start(w.living)
    assert (r.status_code, code(r)) == (429, "rate_limited")


def test_extend_thirty_minutes_at_most_eight_times(w, monkeypatch):
    w.ready()
    w.allow(w.living)
    s = w.start(w.living).json()["session"]
    exp0 = dt.datetime.fromisoformat(s["expires_at"].replace("Z", "+00:00"))
    assert 29.9 * 60 <= (exp0 - dt.datetime.fromisoformat(s["started_at"].replace("Z", "+00:00"))).total_seconds() <= 30.1 * 60
    for n in range(1, 9):
        r = w.c.post(f"{API}/sessions/{s['session_id']}/extend")
        assert r.status_code == 200 and r.json()["extended_n"] == n
    exp8 = dt.datetime.fromisoformat(r.json()["expires_at"].replace("Z", "+00:00"))
    assert abs((exp8 - exp0).total_seconds() - 8 * 30 * 60) < 5 and r.json()["extensions_left"] == 0
    r = w.c.post(f"{API}/sessions/{s['session_id']}/extend")
    assert (r.status_code, code(r)) == (409, "extend_limit")


def test_a_permanent_cast_only_on_a_screen_marked_permanent(w):
    w.ready()
    w.allow(w.living)
    r = w.start(w.living, duration="permanent")
    assert (r.status_code, code(r)) == (403, "permanent_not_allowed")
    w.allow(w.living, permanent=True, minutes=10)
    s = w.start(w.living, duration="permanent").json()["session"]
    assert s["permanent"] is True and s["expires_at"] is None and s["can"]["extend"] is False
    w.c.delete(f"{API}/sessions/{s['session_id']}")
    s = w.start(w.living).json()["session"]
    mins = (dt.datetime.fromisoformat(s["expires_at"].replace("Z", "+00:00")) - dt.datetime.fromisoformat(s["started_at"].replace("Z", "+00:00"))).total_seconds() / 60
    assert 9.9 <= mins <= 10.1, "the screen's own minutes"


def test_expiry_stops_once_and_switches_off_a_screen_that_was_off_before(w, monkeypatch):
    seed.set_state(w.c, "media_player.tv_living", "off")
    seed.set_state(w.c, "media_player.tv_living_cast", "off")
    w.ready()
    w.allow(w.living)
    s = w.start(w.living).json()["session"]
    assert s["power_off_after"] is True
    assert w.janitor() == {"timeout": 0, "target_gone": 0, "not_confirmed": 0}
    later = dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=31)
    monkeypatch.setattr(cs, "now", lambda: later)
    assert w.janitor()["timeout"] == 1
    assert [p["op"] for p in w.calls] == ["play", "stop", "off"]
    st = w.c.get(f"{API}/sessions/{s['session_id']}").json()
    assert (st["stop_reason"], st["power_off_state"]) == ("timeout", "sent")
    assert w.janitor()["timeout"] == 0 and len(w.calls) == 3, "never retried, never twice"
    assert w.audit("media.cast.power_off")[0]["details"]["status"] == "sent"


def test_the_power_off_can_be_cancelled_at_start_or_at_stop_and_switched_off_globally(w):
    seed.set_state(w.c, "media_player.tv_living", "off")
    seed.set_state(w.c, "media_player.tv_living_cast", "off")
    w.ready()
    w.allow(w.living)
    s = w.start(w.living, power_off_after=False).json()["session"]
    assert s["power_off_after"] is False
    w.c.delete(f"{API}/sessions/{s['session_id']}")
    s = w.start(w.living).json()["session"]
    r = w.c.delete(f"{API}/sessions/{s['session_id']}", params={"power_off": "false"})
    assert r.json()["power_off"] == "cancelled"
    w.c.put(f"{API}/config", json={"power_off_after": False})
    s = w.start(w.living).json()["session"]
    assert s["power_off_after"] is False
    w.c.delete(f"{API}/sessions/{s['session_id']}")
    assert "off" not in [p["op"] for p in w.calls]


def test_a_screen_that_disappears_ends_its_cast_without_a_command(w):
    w.ready()
    w.allow(w.living)
    s = w.start(w.living).json()["session"]
    seed.set_state(w.c, "media_player.tv_living_cast", "unavailable")
    assert w.janitor()["target_gone"] == 1
    assert [p["op"] for p in w.calls] == ["play"]
    assert w.c.get(f"{API}/sessions/{s['session_id']}").json()["stop_reason"] == "target_gone"


def test_not_confirmed_after_fifteen_seconds_without_a_segment(w, monkeypatch):
    w.ready()
    w.allow(w.living)
    s = w.start(w.living).json()["session"]
    later = dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=16)
    monkeypatch.setattr(cs, "now", lambda: later)
    assert w.c.get(f"{API}/sessions/{s['session_id']}").json()["state"] == "not_confirmed"
    assert w.janitor()["not_confirmed"] == 1


def test_switch_camera_gets_a_new_token_and_the_old_one_dies(w):
    w.ready()
    w.allow(w.living)
    s = w.start(w.living).json()["session"]
    old = w.plays()[0]["url"]
    r = w.c.post(f"{API}/sessions/{s['session_id']}/switch", json={"camera_id": "cam2"})
    assert r.status_code == 202, r.text
    assert r.json()["session"]["camera_id"] == "cam2" and r.json()["session"]["expires_at"] == s["expires_at"]
    new = w.plays()[1]["url"]
    assert new != old and httpx.get(old, timeout=5).status_code == 403 and httpx.get(new, timeout=5).status_code == 200
    assert w.go2rtc.calls[-1][1]["src"] == "smplwise_nvr-1_ch2_sub"
    assert w.audit("media.cast.switch")[0]["details"]["from_camera"] == "cam1"


def test_main_stream_only_when_allowed_and_h264(w):
    w.ready()
    w.allow(w.living)
    r = w.start(w.living, profile="main")
    assert (r.status_code, code(r)) == (422, "main_not_supported")
    w.c.put(f"{API}/config", json={"allow_main": True})
    assert w.start(w.living, camera="cam2", profile="main").status_code == 422, "an H.265 main stream is refused"
    r = w.start(w.living, profile="main")
    assert r.status_code == 202 and r.json()["session"]["profile"] == "main"
    assert w.plays()[-1]["url"]
    w.allow(w.bedroom, allow_main=False)
    assert w.start(w.bedroom, profile="main").status_code == 422, "the screen's own rule wins"


def test_music_on_the_cast_device_needs_a_confirmation(w):
    seed.set_state(w.c, "media_player.tv_living_cast", "playing", media_content_type="music")
    w.ready()
    w.allow(w.living)
    r = w.start(w.living)
    assert (r.status_code, code(r)) == (409, "cast_busy")
    assert w.start(w.living, confirmed=True).status_code == 202


def test_a_bridge_older_than_0_7_0_is_bridge_outdated(w):
    w.ready()
    w.allow(w.living)
    w.ping("0.6.2")
    r = w.start(w.living)
    assert (r.status_code, code(r)) == (503, "bridge_outdated") and r.json()["details"]["required"] == "0.7.0"
    assert w.calls == []


def test_a_hammering_tv_ends_the_session(w):
    w.ready()
    w.allow(w.living)
    s = w.start(w.living).json()["session"]
    url = w.plays()[0]["url"]
    with httpx.Client(timeout=5) as tv:
        for _ in range(cr.ABUSE_LIMIT + 10):
            tv.get(url)
    st = w.c.get(f"{API}/sessions/{s['session_id']}").json()
    assert st["stop_reason"] == "error" and [p["op"] for p in w.calls] == ["play", "stop"]


def test_an_add_on_restart_keeps_a_running_cast(w):
    w.ready()
    w.allow(w.living)
    w.start(w.living)
    url = w.plays()[0]["url"]
    cr.INDEX.clear()
    assert httpx.get(url, timeout=5).status_code == 403
    cs.attach(w.app.state.db, w.settings)
    assert httpx.get(url, timeout=5).status_code == 200
