"""A standalone Home Assistant camera shown as live video (owner decision 2026-09-30, option (b) of
docs/design/CAMERA_CARD_HA_SOURCE.md): opt-in per camera, the source read through the bridge, ONE go2rtc stream
`smplwise_ha_<slug>`, the same viewing rules / budget / transport as an NVR camera.

The bridge side is the REAL `smplwise_bridge.stream_source` service (integration/.../stream_source_service.py, loaded by
bridge_loader) behind a fake Home Assistant, reached through the add-on's own signing - so the two sides' signature and
answer shapes are tested against each other. go2rtc is the REAL adapter (services/go2rtc.py) over an httpx MockTransport that
records every request. Nothing real is called. The camera's address, user and password below are made up, and every test that
can leak them greps for them."""
from __future__ import annotations

import asyncio
import json
import logging
import socket
import sqlite3
from dataclasses import replace
from types import SimpleNamespace

import httpx
import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from test_camera_card import CARD, NVR_ENTITY, _audit, _deny, _seed_entity, cam_app  # noqa: F401 - the NVR + HA structure fixture
from test_devices import dev_app  # noqa: F401

from bridge_loader import load
from smplwise.db import get_setting, now_iso, set_setting
from smplwise.errors import ApiError
from smplwise.routers import media
from smplwise.services import go2rtc as g2
from smplwise.services import ha_bridge, ha_client
from smplwise.services import ha_camera_streams as hls
from smplwise.services import source_policy as sp

svc = load("stream_source_service")
signing = load("signing")

ENTITY = "camera.garden_cam"
STREAM = "smplwise_ha_garden_cam"
USER, PASSWORD, HOST, TOKEN = "gate-user", "gate-pass-7c1", "192.0.2.60", "tok-91ab"
URL = f"rtsp://{USER}:{PASSWORD}@{HOST}:554/h264/ch1/main/av_stream?token={TOKEN}"
URL2 = f"rtsp://{USER}:{PASSWORD}-new@{HOST}:554/h264/ch1/main/av_stream?token={TOKEN}-new"
SECRETS = (URL, PASSWORD, HOST, TOKEN, USER)
GO2RTC = "http://go2rtc.test:1984"
DNS = {"127.0.0.1.nip.io": ["127.0.0.1"], "alias.rebind.example": ["169.254.169.254"], "cam.lan": ["192.0.2.61"]}  # what the made-up names resolve to
FOREIGN = {
    "door-1": "rtsp://intercom:pw@203.0.113.5/1",  # the other project's streams
    "smplwise_nvr-1_ch1_sub": "rtsp://nvr-user:nvr-pw@203.0.113.9/Streaming/Channels/102",
    "smplwise_wiskey_gate": "rtsp://door:pw@203.0.113.7/Streaming/Channels/101",
}


# ---------------------------------------------------------------- the fakes

class FakeGo2rtcServer:
    """go2rtc's HTTP API behind httpx.MockTransport: GET/PUT/DELETE /api/streams, every request recorded."""

    def __init__(self) -> None:
        self.store: dict[str, list[str]] = {n: [s] for n, s in FOREIGN.items()}
        self.requests: list[tuple[str, str, dict[str, str]]] = []
        self.down = False

    def handler(self, request: httpx.Request) -> httpx.Response:
        params = dict(request.url.params)
        self.requests.append((request.method, request.url.path, params))
        if self.down:
            raise httpx.ConnectError("go2rtc is down")
        if request.url.path == "/api" and request.method == "GET":
            return httpx.Response(200, json={"version": "1.9.14-fake"})
        if request.url.path != "/api/streams":
            return httpx.Response(404)
        if request.method == "GET":
            return httpx.Response(200, json={n: {"producers": [{"url": s} for s in srcs]} for n, srcs in self.store.items()})
        if request.method == "PUT":
            self.store[params["name"]] = [params["src"]]
            return httpx.Response(200)
        if request.method == "DELETE":
            self.store.pop(params["src"], None)
            return httpx.Response(200)
        return httpx.Response(405)

    def writes(self) -> list[tuple[str, str]]:
        return [(m, p.get("name") or p.get("src") or "") for m, path, p in self.requests if m in ("PUT", "DELETE")]


class FakeHass:
    """A fake Home Assistant for the real bridge service: users and states."""

    def __init__(self, users, entities):
        self.users = users
        self.states = SimpleNamespace(get=lambda eid: SimpleNamespace(state="idle", attributes={}) if eid in entities else None)
        self.auth = SimpleNamespace(async_get_user=self._get)

    async def _get(self, uid):
        return self.users.get(uid)


class FakeUser:
    def __init__(self, uid, admin=True, active=True):
        self.id, self.is_admin, self.is_active = uid, admin, active


class LiveBridge:
    """The bridge transport: hands the add-on's signed request to the REAL bridge service against a fake Home Assistant."""

    def __init__(self, secret: str) -> None:
        self.verifier = signing.Verifier(secret)
        self.users = {"dev-joni": FakeUser("dev-joni")}
        self.entities = {ENTITY: URL}
        self.calls: list[str] = []
        self.payloads: list[dict] = []

    def stream_source(self, settings, payload):
        self.calls.append(payload["entity_id"])
        self.payloads.append(dict(payload))
        hass = FakeHass(self.users, set(self.entities))

        async def getter(_hass, entity_id):
            return self.entities[entity_id]

        original = svc._ha
        svc._ha = lambda: SimpleNamespace(get_stream_source=getter)
        try:
            return asyncio.run(svc.async_handle_stream_source(hass, self.verifier, dict(payload)))
        finally:
            svc._ha = original


class Live:
    pass


@pytest.fixture(autouse=True)
def _no_real_dns(monkeypatch):
    monkeypatch.setattr(sp, "resolve_host", lambda host, timeout=2.0: list(DNS.get(host, [])))


@pytest.fixture()
def live(cam_app, monkeypatch):  # noqa: F811
    app, s, c, ids = cam_app
    app.state.settings = replace(app.state.settings, go2rtc_url=GO2RTC)
    _seed_entity(app, ENTITY, platform="generic", device_id="dev-garden", name="גינה", area=None)
    with app.state.db.connection() as conn:
        secret = ha_bridge.ensure_pairing(conn)
        set_setting(conn, "bridge.paired_at", now_iso())
        set_setting(conn, "bridge.integration_version", "0.3.1")
    go = FakeGo2rtcServer()
    real = httpx.Client

    def factory(**kw):
        if str(kw.get("base_url", "")).rstrip("/") == GO2RTC:
            return real(transport=httpx.MockTransport(go.handler), **kw)
        return real(**kw)

    monkeypatch.setattr(g2.httpx, "Client", factory)
    bridge = LiveBridge(secret)
    hls.set_transport(SimpleNamespace(stream_source=bridge.stream_source))
    svc._calls.clear()
    svc._calls_by_entity.clear()
    with hls._LOCK:
        hls._LAST_READ.clear()
        hls._STALE.clear()
        hls._REREADS.clear()
    hls._WRITTEN.clear()
    hls._last_reconcile = 0.0
    monkeypatch.setattr(hls, "REREAD_MIN_INTERVAL_S", 0.0)
    monkeypatch.setattr(hls, "WRITE_GRACE_S", 0.0)  # the tests that are about the grace set their own
    sp._RESOLVED.clear()
    monkeypatch.setattr(sp, "resolve_host", lambda host, timeout=2.0: list(DNS.get(host, [])))  # no test resolves a real name

    async def bridge_resolve(host):
        return list(DNS.get(host, []))

    monkeypatch.setattr(svc, "_resolve", bridge_resolve)
    out = Live()
    out.app, out.s, out.c, out.ids, out.go, out.bridge = app, app.state.settings, c, ids, go, bridge
    yield out
    hls.set_transport(None)
    svc._calls.clear()


def enable(live, entity=ENTITY, headers=None):
    return live.c.put(f"{CARD}/ha-live/{entity}", headers=headers)


def resolve(live, entity=ENTITY, headers=None):
    return live.c.get(f"{CARD}/resolve", params={"kind": "ha", "entity_id": entity}, headers=headers)


def db_dump(app) -> str:
    """Every value of every table of the database, as text: the place a secret must never be."""
    with app.state.db.connection(mode="read") as conn:
        out = []
        for (name,) in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall():
            try:
                out.extend(str(tuple(r)) for r in conn.execute(f'SELECT * FROM "{name}"').fetchall())
            except sqlite3.Error:
                pass
        return "\n".join(out)


def assert_no_secret(text: str, where: str = "") -> None:
    for part in SECRETS:
        assert part not in text, f"{part!r} leaked {where}"
    import re

    assert not re.search(r"rtsps?://(?!\*\*\*)", text), f"a source address leaked {where}"  # the redacted scheme `rtsp://***` is fine


# ---------------------------------------------------------------- opt-out is the default

def test_nothing_is_live_by_default_and_the_picture_stays(live):
    body = live.c.get(f"{CARD}/sources").json()
    cam = next(h for h in body["ha_cameras"] if h["entity_id"] == ENTITY)
    assert cam["mode"] == "still_only" and cam["live_enabled"] is False
    assert body["ha_live"] == {"ready": True, "can_configure": True}
    r = resolve(live).json()
    assert r["state"] == "still_only" and "live_path" not in r
    with live.app.state.db.connection(mode="read") as conn:
        assert hls.enabled(conn) == {} and get_setting(conn, hls.KEY) is None
    assert live.go.writes() == [] and live.bridge.calls == []  # not one write, not one question to Home Assistant
    # an NVR channel entity is not part of this at all
    assert resolve(live, NVR_ENTITY).json()["state"] == "live"


def test_a_camera_that_is_not_enabled_cannot_be_watched_even_by_the_administrator(live, monkeypatch):
    monkeypatch.setattr(media, "relay_ws", _fake_relay([]))
    with pytest.raises(WebSocketDisconnect) as e:
        with live.c.websocket_connect(f"/api/v1/media/live-ha/{ENTITY}/ws"):
            pass
    assert e.value.code == 4403
    denied = [r for r in _audit(live.app, "video.live") if r["decision"] == "denied" and r["resource_id"] == ENTITY]
    assert denied and denied[0]["resource_type"] == "ha_entity"
    assert live.go.writes() == []


# ---------------------------------------------------------------- enable

def test_enable_reads_the_source_through_the_bridge_and_writes_one_namespaced_stream(live):
    r = enable(live)
    assert r.status_code == 200, r.text
    assert r.json() == {"entity_id": ENTITY, "enabled": True, "result": "created"}
    assert_no_secret(r.text, "in the enable answer")
    assert live.bridge.calls == [ENTITY]
    # the bridge got a request signed with the pairing secret, for the acting person, exactly these keys
    assert set(live.bridge.payloads[0]) == {"user_id", "entity_id", "request_id", "ts", "nonce", "sig"} and live.bridge.payloads[0]["user_id"] == "dev-joni"
    # exactly one go2rtc write: the PUT of our stream, with the source; the foreign streams were only ever listed
    assert live.go.writes() == [("PUT", STREAM)]
    assert live.go.store[STREAM] == [URL]
    assert {n: s for n, s in live.go.store.items() if n != STREAM} == {n: [s] for n, s in FOREIGN.items()}
    with live.app.state.db.connection(mode="read") as conn:
        rec = hls.enabled(conn)
    assert list(rec) == [ENTITY] and rec[ENTITY]["enabled_by"] == "dev-joni"
    # it resolves to live for the caller, through the relay's own path
    res = resolve(live).json()
    assert res["state"] == "ha_live" and res["live_path"] == f"media/live-ha/{ENTITY}/ws" and res["name"] == "גינה" and res["status"] == "online"
    assert_no_secret(json.dumps(res), "in resolve")
    body = live.c.get(f"{CARD}/sources").json()
    assert next(h for h in body["ha_cameras"] if h["entity_id"] == ENTITY)["live_enabled"] is True
    # the picture route still works as the fallback
    assert live.c.get(f"{CARD}/still", params={"entity_id": ENTITY}).status_code in (200, 503)


def test_enable_again_reads_the_source_again_and_updates_the_stream(live):
    assert enable(live).json()["result"] == "created"
    live.bridge.entities[ENTITY] = URL2
    assert enable(live).json()["result"] == "updated"
    assert live.go.store[STREAM] == [URL2]
    assert enable(live).json()["result"] == "unchanged"  # the same source again: no write


def test_the_source_never_reaches_the_database_the_audit_the_logs_or_any_answer(live, caplog):
    caplog.set_level(logging.DEBUG)
    answers = [enable(live).text, resolve(live).text, live.c.get(f"{CARD}/sources").text, live.c.get("/api/v1/media/streams").text, live.c.get("/api/v1/media/sessions").text]
    answers.append(live.c.delete(f"{CARD}/ha-live/{ENTITY}").text)
    for text in answers:
        assert_no_secret(text, "in an API answer")
    assert_no_secret(db_dump(live.app), "in the database")
    assert_no_secret(caplog.text, "in a log line")
    assert "created" in caplog.text and STREAM in caplog.text  # the adapter did log the write - with the source hidden
    rows = _audit(live.app, "camera_card.ha_live.enable")
    assert [json.loads(r["details_json"])["phase"] for r in rows] == ["attempt", "outcome"] and all(r["resource_id"] == ENTITY for r in rows)


def test_the_streams_listing_shows_the_scheme_only(live):
    enable(live)
    listing = live.c.get("/api/v1/media/streams").json()
    ours = next(s for s in listing["streams"] if s["name"] == STREAM)
    assert ours["sources"] == ["rtsp://***"]
    assert g2.redact_ha_source(URL) == "rtsp://***" and g2.redact_ha_source("rtsp://gate-user@h/x") == "rtsp://***" and g2.redact_ha_source("garbage") == "***"
    assert g2.redact_source(STREAM, URL) == "rtsp://***"
    assert g2.redact_source("smplwise_nvr-1_ch1_sub", "rtsp://u:p@nvr.local/x") == "rtsp://***@nvr.local/x"  # the other rules are unchanged


@pytest.mark.parametrize(
    "answer, status, code",
    [
        (None, 422, "no_stream_source"),
        ("", 422, "no_stream_source"),
        ("exec:ffmpeg -i x -f mpegts -", 422, "source_not_supported"),
        (f"ffmpeg:{URL}#video=h264", 422, "source_not_supported"),
        (f"{URL}#video=copy", 422, "source_not_supported"),
        (f"rtmp://{USER}:{PASSWORD}@{HOST}/live", 422, "source_not_supported"),
        # M1: a source that points go2rtc back at itself or at the host it runs on (refused by the real bridge policy)
        ("rtsp://127.0.0.1:1984/api/frame.jpeg?src=rtsp://evil&name=smplwise_wiskey_gate", 422, "source_not_allowed"),
        (f"rtsp://{USER}:{PASSWORD}@127.0.0.1.nip.io/live", 422, "source_not_allowed"),  # M1-residual: a name that resolves to loopback
        # M1-residual: only rtsp / rtsps; an http(s) source is an indirect route back into go2rtc
        ("http://127.0.0.1:1984/api/frame.jpeg?src=rtsp://evil&name=smplwise_wiskey_gate", 422, "source_not_supported"),
        (f"http://{USER}:{PASSWORD}@{HOST}:8080/video.mjpg", 422, "source_not_supported"),
        (f"https://{HOST}/stream?token={TOKEN}", 422, "source_not_supported"),
        (f"rtsp://{USER}:{PASSWORD}@localhost/live", 422, "source_not_allowed"),
        (f"rtsp://{USER}:{PASSWORD}@{HOST}/live?src=rtsp://evil", 422, "source_not_allowed"),
    ],
)
def test_a_missing_or_unusable_source_refuses_and_writes_nothing(live, answer, status, code):
    live.bridge.entities[ENTITY] = answer
    r = enable(live)
    assert r.status_code == status and r.json()["code"] == code, r.text
    assert_no_secret(r.text, "in the refusal")
    assert live.go.writes() == []
    with live.app.state.db.connection(mode="read") as conn:
        assert hls.enabled(conn) == {}
    outcome = [json.loads(x["details_json"]) for x in _audit(live.app, "camera_card.ha_live.enable") if x["decision"] == "denied"]
    assert outcome and outcome[0]["phase"] == "outcome"
    assert_no_secret(db_dump(live.app), "in the database")
    assert resolve(live).json()["state"] == "still_only"


def test_the_add_on_checks_the_source_again_even_if_the_bridge_answers_something_unsafe(live):
    """A bridge that is old, modified or spoofed by something between the two: the add-on's own check still holds."""
    class Loose:
        def stream_source(self, settings, payload):
            return {"ok": True, "request_id": payload["request_id"], "stream_source": "exec:ffmpeg -i http://x -f mpegts -"}

    hls.set_transport(Loose())
    r = enable(live)
    assert r.status_code == 422 and r.json()["code"] == "source_not_supported"
    assert live.go.writes() == []


@pytest.mark.parametrize("source", ["rtsp://go2rtc.test:8554/smplwise_wiskey_gate", "rtsp://go2rtc.test:1984/x", "rtsps://go2rtc.test:8555/x", "rtsp://GO2RTC.TEST:8554/door-1"])
def test_the_add_on_refuses_go2rtcs_own_host_which_the_bridge_cannot_know(live, source):
    """M1: `rtsp://<go2rtc host>:8554/<foreign stream>` would restream another project's door station to every viewer. The real
    bridge does not know where go2rtc runs and lets it through; the add-on's own check does not."""
    live.bridge.entities[ENTITY] = source
    r = enable(live)
    assert r.status_code == 422 and r.json()["code"] == "source_not_allowed", r.text
    assert live.go.writes() == []
    # the same host on a camera's port is fine (another add-on on the machine)
    live.bridge.entities[ENTITY] = f"rtsp://{USER}:{PASSWORD}@go2rtc.test:554/cam"
    assert enable(live).status_code == 200


def test_a_home_assistant_user_who_is_not_an_administrator_is_refused_by_the_bridge(live):
    live.bridge.users["dev-joni"].is_admin = False
    r = enable(live)
    assert r.status_code == 403 and r.json()["code"] == "ha_admin_required"
    assert live.go.writes() == []


def test_the_bridge_error_text_is_never_forwarded(live):
    class Boom:
        def stream_source(self, settings, payload):
            return {"ok": False, "request_id": payload["request_id"], "error": f"rtsp://{USER}:{PASSWORD}@{HOST}/x failed"}

    hls.set_transport(Boom())
    r = enable(live)
    assert r.status_code == 502 and r.json()["code"] == "bridge_error" and r.json()["details"] == {"error": "unknown"}
    assert_no_secret(r.text)
    hls.set_transport(SimpleNamespace(stream_source=lambda s, p: {"ok": False, "error": "CameraBoom"}))
    assert enable(live).json()["details"] == {"error": "CameraBoom"}


def test_enable_needs_sources_configure_and_names_nothing_to_others(live):
    s, c = live.s, live.c
    bind(c, s, "vera", "viewer", "installation", "*")
    bind(c, s, "sam", "site_admin", "installation", "*")  # runs the sites but does not define sources
    for who in ("vera", "sam"):
        r = enable(live, headers=as_user(who))
        assert r.status_code == 403, who
        assert c.delete(f"{CARD}/ha-live/{ENTITY}", headers=as_user(who)).status_code == 403
    denied = [x for x in _audit(live.app, "sources.configure") if x["decision"] == "denied"]
    assert len(denied) == 4
    assert live.bridge.calls == [] and live.go.writes() == []
    body = c.get(f"{CARD}/sources", headers=as_user("vera")).json()
    assert body["ha_live"]["can_configure"] is False


def test_prerequisites_are_checked_before_anything_is_asked(live, monkeypatch):
    # go2rtc not configured
    live.app.state.settings = replace(live.app.state.settings, go2rtc_url=None)
    r = enable(live)
    assert r.status_code == 409 and r.json()["code"] == "media_not_configured"
    assert live.c.get(f"{CARD}/sources").json()["ha_live"] == {"ready": False, "can_configure": False}
    live.app.state.settings = replace(live.app.state.settings, go2rtc_url=GO2RTC)
    # bridge not paired / too old
    with live.app.state.db.connection() as conn:
        set_setting(conn, "bridge.integration_version", "0.3.0")
    r = enable(live)
    assert r.status_code == 503 and r.json()["code"] == "bridge_too_old"
    with live.app.state.db.connection() as conn:
        set_setting(conn, "bridge.integration_version", "0.3.1")
        set_setting(conn, "bridge.paired_at", "")
    assert enable(live).json()["code"] == "bridge_not_paired"
    assert live.bridge.calls == [] and live.go.writes() == []


def test_only_a_standalone_known_lower_case_camera_can_be_enabled(live):
    assert enable(live, NVR_ENTITY).status_code == 409  # an NVR channel already plays as its channel
    assert enable(live, "camera.nowhere").status_code == 404
    assert enable(live, "camera.Garden_Cam").status_code == 422
    assert enable(live, "light.lobby").status_code == 422
    assert enable(live, "camera.a%2F..%2Fb").status_code in (404, 422)
    assert live.go.writes() == [] and live.bridge.calls == []


# ---------------------------------------------------------------- the namespace guard

def test_the_namespace_guard_refuses_a_name_outside_the_namespace(live):
    client = g2.Go2rtc(live.s)
    with pytest.raises(ValueError):
        client.ensure_stream("door-1", "rtsp://x/y")
    with pytest.raises(ValueError):
        client.delete_stream("door-1")
    # the narrower guard of this feature: our other streams (NVR, WisKey) are not its to write or delete either
    for name in ("door-1", "smplwise_nvr-1_ch1_sub", "smplwise_wiskey_gate", "smplwise_", "smplwise_hax"):
        with pytest.raises(ValueError):
            hls._delete_stream(live.s, name)
    for bad in ("light.x", "camera.", "camera.Garden", "camera.a/b", "camera.a b", "camera.ab..c", "camera." + "a" * 101, "smplwise_ha_x", "", "camera.x\n"):
        with pytest.raises(ValueError):
            g2.ha_stream_name(bad)
    assert g2.ha_stream_name(ENTITY) == STREAM
    assert live.go.writes() == []
    assert live.go.store["door-1"] == [FOREIGN["door-1"]]


def test_reconcile_deletes_only_smplwise_ha_streams_nobody_wants(live):
    enable(live)
    live.go.store["smplwise_ha_stray"] = ["rtsp://old"]  # left behind, no opt-in
    live.go.requests.clear()
    out = hls.reconcile(live.app.state.db, live.s, force=True)
    assert out == {"dropped": 0, "deleted": 1}
    assert live.go.writes() == [("DELETE", "smplwise_ha_stray")]
    assert STREAM in live.go.store and all(n in live.go.store for n in FOREIGN)
    assert hls.reconcile(live.app.state.db, live.s) == {"dropped": 0, "deleted": 0}  # throttled


# ---------------------------------------------------------------- disable / the camera disappears

def test_disable_removes_the_opt_in_and_deletes_the_stream(live):
    enable(live)
    live.go.requests.clear()
    r = live.c.delete(f"{CARD}/ha-live/{ENTITY}")
    assert r.status_code == 200 and r.json() == {"entity_id": ENTITY, "enabled": False, "stream_removed": True}
    assert live.go.writes() == [("DELETE", STREAM)] and STREAM not in live.go.store
    assert all(n in live.go.store for n in FOREIGN)
    with live.app.state.db.connection(mode="read") as conn:
        assert hls.enabled(conn) == {}
    assert resolve(live).json()["state"] == "still_only"
    rows = _audit(live.app, "camera_card.ha_live.disable")
    assert len(rows) == 1 and json.loads(rows[0]["details_json"])["stream_removed"] is True
    # again: nothing to remove, still fine
    assert live.c.delete(f"{CARD}/ha-live/{ENTITY}").json()["enabled"] is False


def test_disable_with_go2rtc_down_still_removes_the_opt_in_and_reconcile_deletes_the_stream_later(live):
    enable(live)
    live.go.down = True
    r = live.c.delete(f"{CARD}/ha-live/{ENTITY}")
    assert r.status_code == 200 and r.json()["stream_removed"] is False
    with live.app.state.db.connection(mode="read") as conn:
        assert hls.enabled(conn) == {}  # nobody can open it any more
    live.go.down = False
    assert STREAM in live.go.store
    assert hls.reconcile(live.app.state.db, live.s, force=True)["deleted"] == 1 and STREAM not in live.go.store


def test_a_camera_that_disappears_from_home_assistant_loses_its_stream_and_its_opt_in(live):
    enable(live)
    with live.app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET removed_at = ? WHERE entity_id = ?", (now_iso(), ENTITY))
    live.go.requests.clear()
    out = hls.reconcile(live.app.state.db, live.s, force=True)
    assert out == {"dropped": 1, "deleted": 1}
    assert live.go.writes() == [("DELETE", STREAM)]
    with live.app.state.db.connection(mode="read") as conn:
        assert hls.enabled(conn) == {}
    gone = [x for x in _audit(live.app, "camera_card.ha_live.disable") if x["reason"] == "camera_gone"]
    assert len(gone) == 1 and gone[0]["actor_user_id"] is None


def test_a_disabled_entity_keeps_its_opt_in_but_not_its_stream(live):
    enable(live)
    with live.app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET disabled = 1 WHERE entity_id = ?", (ENTITY,))
    out = hls.reconcile(live.app.state.db, live.s, force=True)
    assert out == {"dropped": 0, "deleted": 1} and STREAM not in live.go.store
    with live.app.state.db.connection(mode="read") as conn:
        assert ENTITY in hls.enabled(conn)
    assert resolve(live).json() == {"state": "missing"}


def test_the_janitor_runs_the_reconcile(live):
    from smplwise.main import janitor_tick

    enable(live)
    live.go.store["smplwise_ha_stray"] = ["rtsp://old"]
    janitor_tick(live.app.state.db, live.s)
    assert "smplwise_ha_stray" not in live.go.store and STREAM in live.go.store


# ---------------------------------------------------------------- viewing

def _fake_relay(frames, reason="upstream_closed"):
    """Stands in for the go2rtc socket: sends `frames` (through on_text, like the real relay) then ends."""

    async def relay(websocket, upstream_url, headers, on_down, should_stop=None, on_text=None):
        assert upstream_url == f"ws://go2rtc.test:1984/api/ws?src={STREAM}"  # the stream NAME only: no source in the URL
        for f in frames:
            out = on_text(f) if on_text else f
            if out is not None:
                await websocket.send_text(out)
        return reason

    return relay


def test_a_viewer_plays_through_the_relay_with_the_budget_and_an_audit_row(live, monkeypatch):
    enable(live)
    seen = {}

    async def relay(websocket, upstream_url, headers, on_down, should_stop=None, on_text=None):
        seen["sessions"] = [(s.camera_id, s.stream) for s in media.REGISTRY.sessions.values()]
        await websocket.send_text('{"type":"mse","value":"video/mp4"}')
        return "client_closed"

    monkeypatch.setattr(media, "relay_ws", relay)
    with live.c.websocket_connect(f"/api/v1/media/live-ha/{ENTITY}/ws") as ws:
        assert json.loads(ws.receive_text())["type"] == "mse"
    assert seen["sessions"] == [(ENTITY, STREAM)]  # counted in the shared budget like any live stream
    assert media.REGISTRY.count() == 0
    start = [r for r in _audit(live.app, "video.live.start")]
    stop = [r for r in _audit(live.app, "video.live.stop")]
    assert start and stop and start[-1]["resource_type"] == "ha_entity" and start[-1]["resource_id"] == ENTITY
    assert_no_secret(json.dumps([dict(r) for r in start + stop]), "in the session audit")


def test_the_session_budget_applies(live, monkeypatch):
    enable(live)
    monkeypatch.setattr(media, "relay_ws", _fake_relay([]))
    assert live.c.patch("/api/v1/settings", json={"media.max_live_sessions": 1}).status_code == 200
    media.REGISTRY.sessions["other"] = media.LiveSession(id="other", camera_id="x", stream="s", user_id="u", username="u")
    try:
        with pytest.raises(WebSocketDisconnect) as e:
            with live.c.websocket_connect(f"/api/v1/media/live-ha/{ENTITY}/ws"):
                pass
        assert e.value.code == 4429
    finally:
        media.REGISTRY.sessions.pop("other", None)


def test_the_viewing_rule_is_video_live_installation_wide_like_the_picture(live, monkeypatch):
    enable(live)
    s, c = live.s, live.c
    monkeypatch.setattr(media, "relay_ws", _fake_relay([]))
    bind(c, s, "vera", "viewer", "installation", "*")
    bind(c, s, "cara", "viewer", "camera", live.ids[1])  # video.live on one camera alone does not reach it
    _deny(live.app, "vera", "viewer", "camera", live.ids[1])  # a deny on an NVR camera does not make a standalone one unreachable
    assert resolve(live, headers=as_user("vera")).json()["state"] == "ha_live"
    with live.c.websocket_connect(f"/api/v1/media/live-ha/{ENTITY}/ws", headers=as_user("vera")):
        pass
    assert resolve(live, headers=as_user("cara")).status_code in (200, 403)
    assert resolve(live, headers=as_user("cara")).json().get("state") in ("forbidden", None)
    with pytest.raises(WebSocketDisconnect) as e:
        with live.c.websocket_connect(f"/api/v1/media/live-ha/{ENTITY}/ws", headers=as_user("cara")):
            pass
    assert e.value.code == 4403
    # a person with no binding at all
    with pytest.raises(WebSocketDisconnect) as e2:
        with live.c.websocket_connect(f"/api/v1/media/live-ha/{ENTITY}/ws", headers=as_user("nobody")):
            pass
    assert e2.value.code == 4403


def test_go2rtc_error_frames_never_reach_the_viewer_and_mark_the_stream_stale(live, monkeypatch):
    enable(live)
    err = json.dumps({"type": "error", "value": f"streams: dial {URL}: i/o timeout"})
    monkeypatch.setattr(media, "relay_ws", _fake_relay(['{"type":"webrtc/candidate","value":"x"}', err]))
    with live.c.websocket_connect(f"/api/v1/media/live-ha/{ENTITY}/ws") as ws:
        got = [ws.receive_text(), ws.receive_text()]
    assert json.loads(got[0])["type"] == "webrtc/candidate"
    assert json.loads(got[1]) == {"type": "error", "value": "upstream_unavailable"}
    assert_no_secret("".join(got), "in the frames a viewer received")
    assert ENTITY in hls._STALE


def test_a_failing_stream_makes_the_next_open_read_the_source_again(live, monkeypatch):
    """Sources change (a password, an address): the failure is noticed, and the next viewer's open re-reads and re-points."""
    enable(live)
    assert live.bridge.calls == [ENTITY]
    live.bridge.entities[ENTITY] = URL2  # the camera's source changed in Home Assistant
    err = json.dumps({"type": "error", "value": "streams: nope"})
    monkeypatch.setattr(media, "relay_ws", _fake_relay([err]))
    with live.c.websocket_connect(f"/api/v1/media/live-ha/{ENTITY}/ws") as ws:
        ws.receive_text()
    assert live.go.store[STREAM] == [URL]  # nothing re-read yet
    monkeypatch.setattr(media, "relay_ws", _fake_relay([]))
    with live.c.websocket_connect(f"/api/v1/media/live-ha/{ENTITY}/ws"):
        pass
    assert live.bridge.calls == [ENTITY, ENTITY] and live.go.store[STREAM] == [URL2]
    assert ENTITY not in hls._STALE
    refresh = _audit(live.app, "camera_card.ha_live.refresh")
    assert len(refresh) == 1 and refresh[0]["decision"] == "allowed" and refresh[0]["actor_user_id"] is None
    assert_no_secret(db_dump(live.app), "in the database")
    # a healthy stream is never re-read
    with live.c.websocket_connect(f"/api/v1/media/live-ha/{ENTITY}/ws"):
        pass
    assert live.bridge.calls == [ENTITY, ENTITY]


def test_a_stream_go2rtc_forgot_is_created_again_on_open(live, monkeypatch):
    enable(live)
    live.go.store.pop(STREAM)  # go2rtc restarted without it
    monkeypatch.setattr(media, "relay_ws", _fake_relay([]))
    with live.c.websocket_connect(f"/api/v1/media/live-ha/{ENTITY}/ws"):
        pass
    assert live.go.store[STREAM] == [URL] and live.bridge.calls == [ENTITY, ENTITY]


def test_a_failing_source_is_not_asked_for_in_a_loop(live, monkeypatch):
    enable(live)
    monkeypatch.setattr(hls, "REREAD_MIN_INTERVAL_S", 3600.0)
    hls._mark_read(ENTITY)
    hls.mark_stale(ENTITY)
    live.go.store.pop(STREAM)
    with pytest.raises(ApiError) as e:
        hls.ensure_ready(live.app.state.db, live.s, ENTITY)
    assert e.value.code == "ha_live_unavailable" and live.bridge.calls == [ENTITY]  # only the enable's own question
    live.go.store[STREAM] = [URL]  # an existing stream is served as it is
    assert hls.ensure_ready(live.app.state.db, live.s, ENTITY) == STREAM and live.bridge.calls == [ENTITY]


def test_a_refresh_that_cannot_read_leaves_the_existing_stream_alone(live, monkeypatch):
    enable(live)
    hls.mark_stale(ENTITY)
    live.bridge.users["dev-joni"].is_admin = False  # the person who enabled it is no longer an HA administrator
    monkeypatch.setattr(media, "relay_ws", _fake_relay([]))
    with live.c.websocket_connect(f"/api/v1/media/live-ha/{ENTITY}/ws"):
        pass
    assert live.go.store[STREAM] == [URL]
    refresh = _audit(live.app, "camera_card.ha_live.refresh")
    assert refresh[-1]["decision"] == "denied" and refresh[-1]["reason"] == "ha_admin_required"


def test_a_session_that_go2rtc_ends_at_once_marks_the_stream_stale(live):
    hls.note_session_end(ENTITY, "client_closed", 1.0)
    hls.note_session_end(ENTITY, "access_lost", 1.0)
    hls.note_session_end(ENTITY, "upstream_closed", 300.0)
    assert ENTITY not in hls._STALE
    hls.note_session_end(ENTITY, "ConnectionClosedError", 2.0)
    assert ENTITY in hls._STALE


def test_disabling_ends_the_access_of_open_and_new_viewers(live, monkeypatch):
    enable(live)
    live.c.delete(f"{CARD}/ha-live/{ENTITY}")
    monkeypatch.setattr(media, "relay_ws", _fake_relay([]))
    with pytest.raises(WebSocketDisconnect) as e:
        with live.c.websocket_connect(f"/api/v1/media/live-ha/{ENTITY}/ws"):
            pass
    assert e.value.code == 4403
    with live.app.state.db.connection(mode="read") as conn:
        assert hls.viewer_allowed(conn, SimpleNamespace(user_id="dev-joni", username="joni", display_name="", source="dev"), ENTITY) is False


# ---------------------------------------------------------------- units

@pytest.mark.parametrize(
    "value, code",
    [
        (URL, None),
        ("rtsps://cam.local/stream?x=1", None),
        ("https://cam.local/stream?x=1", "source_not_supported"),
        ("http://192.0.2.60/x", "source_not_supported"),
        ("rtsp://127.0.0.1.nip.io/x", "source_not_allowed"),
        (None, "no_stream_source"),
        ("", "no_stream_source"),
        ("exec:x", "source_not_supported"),
        ("ffmpeg:rtsp://x", "source_not_supported"),
        ("rtsp://x/y z", "source_not_supported"),
        ("rtsp://x/y#z", "source_not_supported"),
        ("rtsp://x/\n", "source_not_supported"),
        ("rtsp://x/" + "a" * 2100, "source_not_supported"),
        (5, "no_stream_source"),
    ],
)
def test_source_error(value, code):
    assert hls.source_error(value) == code


def test_sanitize_frame():
    assert hls.sanitize_frame(ENTITY, '{"type":"mse","value":"x"}') == '{"type":"mse","value":"x"}'
    assert hls.sanitize_frame(ENTITY, "not json {") == "not json {"
    assert ENTITY not in hls._STALE
    assert json.loads(hls.sanitize_frame(ENTITY, '{"type":"error","value":"rtsp://u:p@h/x"}')) == {"type": "error", "value": "upstream_unavailable"}
    assert ENTITY in hls._STALE


def test_the_bridge_client_keeps_only_the_answer_and_never_forwards_a_body(settings, monkeypatch, caplog):
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="tok")
    real = httpx.Client
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers.get("authorization")
        return httpx.Response(200, json={"changed_states": [], "service_response": {"ok": True, "request_id": "r", "stream_source": URL, "extra": "dropped"}})

    monkeypatch.setattr(ha_client.httpx, "Client", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    caplog.set_level(logging.DEBUG)
    out = ha_client.call_bridge_stream_source(s, {"user_id": "u", "entity_id": ENTITY})
    assert out == {"ok": True, "request_id": "r", "stream_source": URL}
    assert seen["url"] == "http://ha.local:8123/api/services/smplwise_bridge/stream_source?return_response" and seen["auth"] == "Bearer tok"
    assert_no_secret(caplog.text)
    for status, text, code in ((404, "Service not found", "bridge_too_old"), (500, f"boom {URL}", "bridge_error"), (401, "no", "ha_forbidden")):
        monkeypatch.setattr(ha_client.httpx, "Client", lambda text=text, status=status, **kw: real(transport=httpx.MockTransport(lambda r: httpx.Response(status, text=text)), **kw))
        with pytest.raises(ApiError) as e:
            ha_client.call_bridge_stream_source(s, {"user_id": "u", "entity_id": ENTITY})
        assert e.value.code == code
        assert_no_secret(json.dumps({"m": e.value.user_message, "d": e.value.details}, ensure_ascii=False))
    monkeypatch.setattr(ha_client.httpx, "Client", lambda **kw: real(transport=httpx.MockTransport(lambda r: httpx.Response(200, content=b"x" * 9000)), **kw))
    with pytest.raises(ApiError) as e:
        ha_client.call_bridge_stream_source(s, {})
    assert e.value.code == "bridge_error"

    def down(request):
        raise httpx.ConnectError(f"cannot reach {URL}")

    monkeypatch.setattr(ha_client.httpx, "Client", lambda **kw: real(transport=httpx.MockTransport(down), **kw))
    with pytest.raises(ApiError) as e:
        ha_client.call_bridge_stream_source(s, {})
    assert e.value.code == "ha_unavailable" and e.value.details == {"error": "ConnectError"}
    assert_no_secret(json.dumps(e.value.details))


# ---------------------------------------------------------------- Opus review L2 - L5

def test_viewer_triggered_rereads_share_one_budget_over_all_cameras(live, monkeypatch):
    """L2: a set of failing cameras cannot spend the bridge's budget: the add-on asks at most REREAD_GLOBAL_MAX times a minute."""
    enable(live)
    monkeypatch.setattr(hls, "REREAD_GLOBAL_MAX", 2)
    before = len(live.bridge.calls)
    for _ in range(4):
        hls.mark_stale(ENTITY)
        assert hls.ensure_ready(live.app.state.db, live.s, ENTITY) == STREAM  # the existing stream is served meanwhile
    assert len(live.bridge.calls) - before == 2
    # the owner's own enable is not part of that budget
    assert enable(live).status_code == 200


def test_reconcile_leaves_a_stream_written_a_moment_ago_alone(live, monkeypatch):
    """L3: an enable writes the stream first and its opt-in commits when the request ends; reconcile must not delete in between."""
    monkeypatch.setattr(hls, "WRITE_GRACE_S", 120.0)
    hls._write_stream(live.s, "camera.new_cam", URL)  # written, opt-in not stored yet
    assert hls.reconcile(live.app.state.db, live.s, force=True) == {"dropped": 0, "deleted": 0}
    assert "smplwise_ha_new_cam" in live.go.store
    monkeypatch.setattr(hls, "WRITE_GRACE_S", 0.0)  # once the grace has passed and there is still no opt-in, it goes
    assert hls.reconcile(live.app.state.db, live.s, force=True)["deleted"] == 1 and "smplwise_ha_new_cam" not in live.go.store


def test_reconcile_asks_the_opt_in_list_again_right_before_each_delete(live, monkeypatch):
    _seed_entity(live.app, "camera.late_cam", platform="generic", device_id="dev-late", area=None)
    live.go.store["smplwise_ha_late_cam"] = ["rtsp://old.example/x"]  # a stray as far as the first look can tell
    original = live.go.handler
    seen = []

    def handler(request):
        response = original(request)
        if request.method == "GET" and request.url.path == "/api/streams" and not seen:
            seen.append(1)  # an administrator enables the camera just after reconcile listed the streams
            with live.app.state.db.connection() as conn:
                cams = hls._load(conn)
                cams["camera.late_cam"] = {"enabled_at": now_iso(), "enabled_by": "dev-joni"}
                hls._save(conn, cams)
        return response

    monkeypatch.setattr(live.go, "handler", handler)
    assert hls.reconcile(live.app.state.db, live.s, force=True)["deleted"] == 0
    assert "smplwise_ha_late_cam" in live.go.store and seen


def test_enable_and_reconcile_write_under_one_lock(live):
    import threading
    import time

    live.go.store["smplwise_ha_stray"] = ["rtsp://old.example/x"]
    hls._STREAM_LOCK.acquire()
    done = threading.Event()
    worker = threading.Thread(target=lambda: (hls.reconcile(live.app.state.db, live.s, force=True), done.set()))
    try:
        worker.start()
        time.sleep(0.4)
        assert not done.is_set() and "smplwise_ha_stray" in live.go.store  # waiting for the writer that holds the lock
    finally:
        hls._STREAM_LOCK.release()
    worker.join(10)
    assert done.is_set() and "smplwise_ha_stray" not in live.go.store


def test_a_name_that_only_looks_like_ours_is_never_deleted(live):
    """L5: reconcile deletes exactly the shape ha_stream_name builds; a recorder id cannot produce a `smplwise_ha_` name."""
    odd = {"smplwise_ha_": "x", "smplwise_ha_UPPER": "x", "smplwise_ha_a.b": "x", "smplwise_ha_a-b": "x", "smplwise_ha_" + "a" * 101: "x", "smplwise_hax": "x", "smplwise_ha": "x"}
    for name in odd:
        live.go.store[name] = ["rtsp://old.example/x"]
    live.go.store["smplwise_ha_ok_cam"] = ["rtsp://old.example/x"]
    assert hls.reconcile(live.app.state.db, live.s, force=True)["deleted"] == 1
    assert all(n in live.go.store for n in odd) and "smplwise_ha_ok_cam" not in live.go.store
    assert g2.stream_name("nvr-1", 4, "sub") == "smplwise_nvr-1_ch4_sub"
    for bad in ("ha", "ha_x", "ha_"):
        with pytest.raises(ValueError):
            g2.stream_name(bad, 1, "sub")
    assert g2.stream_name("hb", 1, "sub") == "smplwise_hb_ch1_sub" and g2.stream_name("hax", 1, "sub") == "smplwise_hax_ch1_sub"


def test_a_reread_is_not_made_on_behalf_of_someone_who_lost_sources_configure(live, monkeypatch):
    """L4: the stream keeps playing, nothing is asked of the bridge, the picker says so, and enabling it again resumes."""
    enable(live)
    bind(live.c, live.s, "vera", "viewer", "installation", "*")
    with live.app.state.db.connection() as conn:  # the person who enabled it is (now) someone without sources.configure
        cams = hls._load(conn)
        cams[ENTITY]["enabled_by"] = "dev-vera"
        hls._save(conn, cams)
    row = next(h for h in live.c.get(f"{CARD}/sources").json()["ha_cameras"] if h["entity_id"] == ENTITY)
    assert row["live_enabled"] is True and row["live_issue"] == "reread_blocked"
    viewer_row = next(h for h in live.c.get(f"{CARD}/sources", headers=as_user("vera")).json()["ha_cameras"] if h["entity_id"] == ENTITY)
    assert viewer_row["live_issue"] is None  # only for who may act on it
    calls = len(live.bridge.calls)
    hls.mark_stale(ENTITY)
    live.go.store.pop(STREAM)  # even a stream go2rtc lost is not re-created with that identity: nothing is asked
    with pytest.raises(ApiError) as e:
        hls.ensure_ready(live.app.state.db, live.s, ENTITY)
    assert e.value.code == "ha_live_unavailable" and len(live.bridge.calls) == calls
    live.go.store[STREAM] = [URL]
    hls.mark_stale(ENTITY)
    assert hls.ensure_ready(live.app.state.db, live.s, ENTITY) == STREAM and len(live.bridge.calls) == calls and live.go.store[STREAM] == [URL]
    refresh = [r for r in _audit(live.app, "camera_card.ha_live.refresh") if r["decision"] == "denied"]
    assert refresh and refresh[-1]["reason"] == "sources_configure_lost"
    # enabling it again (by an administrator) resumes: the record is theirs
    assert enable(live).status_code == 200
    row = next(h for h in live.c.get(f"{CARD}/sources").json()["ha_cameras"] if h["entity_id"] == ENTITY)
    assert row["live_issue"] is None
    hls.mark_stale(ENTITY)
    live.bridge.entities[ENTITY] = URL2
    hls.ensure_ready(live.app.state.db, live.s, ENTITY)
    assert live.go.store[STREAM] == [URL2]


# ---------------------------------------------------------------- Opus review round 2: M1-residual and L1

def test_the_add_on_refuses_a_name_that_resolves_to_a_refused_address_even_if_the_bridge_lets_it_through(live):
    """M1-residual: the add-on resolves the host itself (the bridge may be old, modified or resolving differently)."""
    class Loose:
        def stream_source(self, settings, payload):
            return {"ok": True, "request_id": payload["request_id"], "stream_source": f"rtsp://{USER}:{PASSWORD}@alias.rebind.example/live"}

    hls.set_transport(Loose())
    r = enable(live)
    assert r.status_code == 422 and r.json()["code"] == "source_not_allowed", r.text
    assert_no_secret(r.text, "in the refusal")
    assert live.go.writes() == []


def test_a_name_that_resolves_to_go2rtcs_own_host_is_refused_on_go2rtcs_rtsp_port(live, monkeypatch):
    """The other alias route: a different NAME for the go2rtc machine, on go2rtc's restream port."""
    real = socket.getaddrinfo
    monkeypatch.setattr(socket, "getaddrinfo", lambda host, *a, **k: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("192.0.2.77", 0))] if host == "go2rtc.test" else real(host, *a, **k))
    monkeypatch.setitem(DNS, "go2rtc-alias.lan", ["192.0.2.77"])
    sp._RESOLVED.clear()
    live.bridge.entities[ENTITY] = "rtsp://go2rtc-alias.lan:8554/door-1"
    r = enable(live)
    assert r.status_code == 422 and r.json()["code"] == "source_not_allowed", r.text
    assert live.go.writes() == []
    live.bridge.entities[ENTITY] = f"rtsp://{USER}:{PASSWORD}@go2rtc-alias.lan:554/cam"
    assert enable(live).status_code == 200


@pytest.mark.parametrize("path", ["/door-1", "/Door-1", "//door-1", "/./door-1", "/x/../door-1", "/%64oor-1", "/%2564oor-1", "/door-1/", "/door-1?x=1", "/smplwise_nvr-1_ch1_sub", "/smplwise_wiskey_gate"])
def test_an_rtsp_source_named_after_a_foreign_go2rtc_stream_is_refused(live, path):
    """M1-residual: `rtsp://<any alias of go2rtc>/<stream>` would re-expose another project's (or our NVR's) stream as a camera."""
    live.bridge.entities[ENTITY] = f"rtsp://{USER}:{PASSWORD}@{HOST}:554{path}"
    r = enable(live)
    assert r.status_code == 422 and r.json()["code"] == "source_not_allowed", r.text
    assert_no_secret(r.text, "in the refusal")
    assert live.go.writes() == [] and all(v == [FOREIGN[k]] for k, v in live.go.store.items() if k in FOREIGN)
    with live.app.state.db.connection(mode="read") as conn:
        assert hls.enabled(conn) == {}


def test_a_source_whose_path_is_not_a_go2rtc_stream_name_is_written(live):
    for path in ("/garden", "/h264/ch1/main/av_stream", "/door-10", "/smplwise_ha_other"):  # the last is one of this feature's own: not foreign
        live.bridge.entities[ENTITY] = f"rtsp://{USER}:{PASSWORD}@{HOST}:554{path}"
        assert enable(live).status_code == 200, path


def test_the_foreign_stream_check_also_holds_for_a_viewers_reread(live):
    enable(live)
    hls.mark_stale(ENTITY)
    live.bridge.entities[ENTITY] = f"rtsp://{USER}:{PASSWORD}@{HOST}:554/door-1"  # the camera now reports a source that names a foreign stream
    hls.ensure_ready(live.app.state.db, live.s, ENTITY)
    assert live.go.store[STREAM] == [URL]  # the old stream is kept, the new source was not written
    refresh = _audit(live.app, "camera_card.ha_live.refresh")
    assert refresh[-1]["decision"] == "denied" and refresh[-1]["reason"] == "source_not_allowed"


def test_names_foreign_stream_on_its_own():
    names = ["door-1", "smplwise_nvr-1_ch1_sub", "smplwise_ha_garden_cam"]
    assert hls.names_foreign_stream("rtsp://h/door-1", names) and hls.names_foreign_stream("rtsp://h/SMPLWISE_NVR-1_CH1_SUB", names)
    assert not hls.names_foreign_stream("rtsp://h/smplwise_ha_garden_cam", names)  # ours, not foreign
    assert not hls.names_foreign_stream("rtsp://h", names) and not hls.names_foreign_stream("rtsp://h/", names) and not hls.names_foreign_stream("rtsp://h/door", names)
    assert not hls.names_foreign_stream("rtsp://h/x/door-1", names)  # only the first segment names a stream


def test_a_camera_switched_off_while_its_source_is_being_read_is_not_written_back(live):
    """L1: ensure_ready re-checks the opt-in inside the stream lock, right before the write (like reconcile before a delete)."""
    enable(live)
    hls.mark_stale(ENTITY)
    live.go.store.pop(STREAM)  # go2rtc forgot it: a viewer opens, the source is read again ...
    real = live.bridge.stream_source

    def read_then_disabled(settings, payload):
        answer = real(settings, payload)
        with live.app.state.db.connection() as conn:  # ... and the administrator switches the camera off before the write
            cams = hls._load(conn)
            cams.pop(ENTITY)
            hls._save(conn, cams)
        return answer

    hls.set_transport(SimpleNamespace(stream_source=read_then_disabled))
    writes_before = len(live.go.writes())
    with pytest.raises(ApiError) as e:
        hls.ensure_ready(live.app.state.db, live.s, ENTITY)
    assert e.value.code == "not_found" and e.value.status == 404
    assert STREAM not in live.go.store and len(live.go.writes()) == writes_before  # nothing came back to life


def test_a_camera_that_is_still_enabled_is_written_by_a_reread(live):
    enable(live)
    hls.mark_stale(ENTITY)
    live.go.store.pop(STREAM)
    assert hls.ensure_ready(live.app.state.db, live.s, ENTITY) == STREAM and live.go.store[STREAM] == [URL]
