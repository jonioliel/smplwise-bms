"""CR-036 slice S0: the reusable fake WisKey (tests/fake_wiskey.py) - its fixtures, its catalog-derived behaviour, its
switches - and the add-on's two live channels run end to end against it (service feed with schema drift, an offline
station, a stale revision, a forbidden account, a slow WisKey; the split background session).

No device, station, Home Assistant or WisKey is contacted: `websockets.connect` is the fake's own `connect`."""
from __future__ import annotations

import asyncio
import json
import re
import time
from dataclasses import replace
from typing import Any

import pytest
from conftest import as_user, bind
from fake_wiskey import FIXTURES, HA_ERROR_CODES, PREFIX, SEPARATE_HANDLERS, FakeWiskey, all_error_codes, fixture
from fastapi.testclient import TestClient

from smplwise.services import intercom_client, intercom_sync, wiskey_background

PERSON_MARKERS = ("Dana", "1001", "+972500000000", "****1234", "person_name", "employee_no", "last_access", "Drift Person")


def frame(command: str, **kw: Any) -> dict[str, Any]:
    return {"id": 7, "type": PREFIX + command, **kw}


def code_of(frames: list[dict[str, Any]]) -> str:
    return "ok" if frames[0]["success"] else frames[0]["error"]["code"]


# ---------------------------------------------------------------- fixtures and the catalog

def test_every_fixture_is_json_synthetic_and_has_provenance():
    names = sorted(p.name for p in FIXTURES.glob("*.json"))
    assert "overview.json" in names and "authorization_session.admin.json" in names and "authorization_session.background.json" in names
    assert (FIXTURES / "PROVENANCE.md").is_file()
    for name in names:
        text = (FIXTURES / name).read_text(encoding="utf-8")
        json.loads(text)
        # no private network address, serial or MAC in a fixture: only the RFC 5737 documentation address is allowed
        assert not re.search(r"\b(10|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d+\.\d+", text), name
        assert not re.search(r"\b([0-9a-f]{2}:){5}[0-9a-f]{2}\b", text, re.I), name


def test_every_error_code_the_fake_answers_is_in_the_catalog_or_home_assistants_own():
    fake = FakeWiskey()
    for code in all_error_codes(fake):
        assert code in fake.errors or code in HA_ERROR_CODES, code


def test_an_unknown_command_and_a_malformed_frame_are_refused_like_home_assistant_does():
    fake = FakeWiskey()
    assert code_of(fake.respond(frame("no/such_command"))) == "unknown_command"
    assert code_of(fake.respond({"id": 1, "type": "something_else"})) == "unknown_command"
    assert code_of(fake.respond(frame("overview", extra=1))) == "invalid_format", "additionalProperties: false"
    assert code_of(fake.respond(frame("users/get"))) == "invalid_format", "user_id is required"
    assert code_of(fake.respond(frame("users/get", user_id=5))) == "invalid_format", "user_id is a string"
    assert code_of(fake.respond(frame("subscribe", api_contract=1))) == "invalid_format", "a separate handler checks its key set exactly"
    assert code_of(fake.respond(frame("overview", api_contract=1))) == "ok"
    loose = FakeWiskey(strict=False)
    assert code_of(loose.respond(frame("overview", extra=1))) == "ok"


def test_every_typed_client_function_gets_an_answer_from_the_admin_identity():
    """Arx's own client, function by function, against the fake: nothing it sends is refused by the catalog checks."""
    from test_wiskey_contract import CLIENT_CALLS

    fake = FakeWiskey()
    fake.overview["stations"].append({**fake.overview["stations"][0], "id": "s1"})  # the contract test's station id

    async def call(msg_type: str, **kw: Any) -> dict[str, Any]:
        return fake.respond({"id": 1, "type": msg_type, **kw})[0]

    for command, invoke in CLIENT_CALLS.items():
        try:
            asyncio.run(invoke(call))
        except (intercom_client.IntercomError, intercom_client.UnclearAnswer) as exc:
            pytest.fail(f"{command}: refused with {exc}")
        except (ValueError, TypeError, KeyError):
            pass  # the fake's generic `{}` for a write is not every function's success shape; the frame was accepted
        assert fake.answered[-1] == (command, "ok"), (command, fake.answered[-1])


def test_every_adapter_read_gets_an_answer_from_the_admin_identity():
    """CR-036 S4: the adapter's typed reads, one by one, against the fake's catalog checks and its S4 fixtures."""
    from test_wiskey_contract import ADAPTER_CALLS

    fake = FakeWiskey().use_directory()
    fake.overview["stations"].append({**fake.overview["stations"][0], "id": "s1"})  # the contract test's station id

    async def call(msg_type: str, **kw: Any) -> dict[str, Any]:
        return fake.respond({"id": 1, "type": msg_type, **kw})[0]

    for command, invoke in ADAPTER_CALLS.items():
        try:
            asyncio.run(invoke(call))
        except intercom_client.IntercomError as exc:
            if (command, exc.code) not in (("users/get", "user_not_found"), ("users/photo_get", "user_not_found"), ("events/detail", "event_not_found")):
                pytest.fail(f"{command}: refused with {exc}")
        assert fake.answered[-1][0] == command and fake.answered[-1][1] in ("ok", "user_not_found", "event_not_found"), (command, fake.answered[-1])


def test_the_admin_overview_lists_every_catalog_command_and_unlist_removes_one():
    fake = FakeWiskey()
    commands = fake.respond(frame("overview"))[0]["result"]["api"]["commands"]
    assert set(commands) == set(fake.commands)
    fake.unlist("users/photo_get")
    assert "users/photo_get" not in fake.respond(frame("overview"))[0]["result"]["api"]["commands"]
    bg = FakeWiskey("background").respond(frame("overview"))[0]["result"]["api"]["commands"]
    assert set(bg) < set(fake.commands), "a restricted identity keeps the fixture's shorter list"


def test_authorization_follows_the_catalog_area_grants():
    commands = FakeWiskey().commands
    bg = FakeWiskey("background")
    for command in ("overview", "authorization/session", "subscribe"):
        assert code_of(bg.respond(frame(command))) == "ok", command
    for command, kw in (("users/get", {"user_id": "u1"}), ("events/list", {"filters": {}}), ("stations/test_unlock", {"station_id": "entry-a", "lock": 1, "api_contract": 1})):
        assert code_of(bg.respond(frame(command, **kw))) == "unauthorized", command
        grants = commands[command]["permission"]["alternative_area_grants"]
        assert all(area != "overview" or level == "manage" for area, level in grants), "the expectation comes from the catalog"
    viewer = FakeWiskey({**fixture("authorization_session.background.json"), "areas": {"overview": "view", "users": "view", "events": "none", "stations": "none", "management": "none"}})
    assert code_of(viewer.respond(frame("users/get", user_id="u1"))) == "ok"
    assert code_of(viewer.respond(frame("users/update", user_id="u1", revision=1, data={}, sync_now=False, api_contract=1))) == "unauthorized", "view is not manage"


def test_a_restricted_account_gets_the_restricted_overview_with_last_access_still_in_it():
    raw = FakeWiskey("background").respond(frame("overview"))[0]["result"]
    assert raw["users"] == [] and raw["user_count"] == 0 and raw["access"]["is_admin"] is False
    assert all("host" not in s and "model" not in s for s in raw["stations"])
    assert any(s.get("last_access") for s in raw["stations"]), "WisKey still sends last_access (D-006 finding): the fake keeps that true"


# ---------------------------------------------------------------- switches

def test_offline_station_switch():
    fake = FakeWiskey().set_offline("entry-a")
    stations = {s["id"]: s for s in fake.respond(frame("overview"))[0]["result"]["stations"]}
    assert stations["entry-a"]["online"] is False and stations["entry-a"]["call_state"] == "unavailable" and stations["entry-a"]["sync_state"] == "offline"
    assert code_of(fake.respond(frame("stations/test_unlock", station_id="entry-a", lock=1, api_contract=1))) == "station_offline"
    assert code_of(fake.respond(frame("stations/test_unlock", station_id="entry-c", lock=1, api_contract=1))) == "ok"
    assert code_of(fake.respond(frame("stations/test_unlock", station_id="nowhere", lock=1, api_contract=1))) == "station_not_found"


def test_stale_revision_switch():
    fake = FakeWiskey()
    fake.stale_revision = True
    assert code_of(fake.respond(frame("users/update", user_id="u1", revision=4, data={}, sync_now=False, api_contract=1))) == "revision_conflict"
    assert code_of(fake.respond(frame("users/delete", user_id="u1", revision=4, api_contract=1))) == "revision_conflict"
    page = fake.respond(frame("users/query", query="", filters={}, offset=0, limit=50, snapshot=""))[0]["result"]
    assert page["stale"] is True


def test_forbidden_switch_all_or_some():
    fake = FakeWiskey().set_forbidden(["users/get"])
    assert code_of(fake.respond(frame("users/get", user_id="u1"))) == "unauthorized"
    assert code_of(fake.respond(frame("overview"))) == "ok"
    fake.set_forbidden(True)
    assert code_of(fake.respond(frame("overview"))) == "unauthorized"
    fake.set_forbidden(False)
    assert code_of(fake.respond(frame("overview"))) == "ok"


def test_schema_drift_switch():
    fake = FakeWiskey()
    fake.drift = True
    raw = fake.respond(frame("overview"))[0]["result"]
    assert "x_unknown_top_level" in raw and all("x_unknown_field" in s and "last_seen" not in s and s["call_state"] == "teleporting" for s in raw["stations"])


def test_slow_switch_delays_the_answer_on_the_socket():
    fake = FakeWiskey()
    fake.slow, fake.slow_commands = 0.3, {"overview"}

    async def run() -> float:
        async with fake.connect("ws://ha.local:8123/api/websocket") as ws:
            assert json.loads(await ws.recv())["type"] == "auth_required"
            await ws.send(json.dumps({"type": "auth", "access_token": "t"}))
            assert json.loads(await ws.recv())["type"] == "auth_ok"
            start = time.monotonic()
            await ws.send(json.dumps(frame("overview")))
            reply = json.loads(await ws.recv())
            assert reply["success"] is True
            return time.monotonic() - start

    assert asyncio.run(run()) >= 0.25


def test_the_socket_refuses_an_unknown_token():
    fake = FakeWiskey()

    async def run() -> str:
        async with fake.connect("ws://x/api/websocket") as ws:
            await ws.recv()
            await ws.send(json.dumps({"type": "auth", "access_token": "nope"}))
            return json.loads(await ws.recv())["type"]

    assert asyncio.run(run()) == "auth_invalid"


# ---------------------------------------------------------------- the add-on's channels against the fake

@pytest.fixture()
def wiskey(settings, monkeypatch):
    """The app with Home Assistant configured and `websockets.connect` replaced by a FakeWiskey (admin service identity, and
    the split background account `bg-token`). The test starts the feeds it needs."""
    import websockets

    from smplwise.main import create_app
    from smplwise.services import wiskey_background_feed as wbf

    fake = FakeWiskey("admin", token="t", more={"bg-token": "background"})
    monkeypatch.setattr(websockets, "connect", fake.connect)
    monkeypatch.setattr(intercom_sync, "RETRY_S", 0.05)
    monkeypatch.setattr(intercom_sync, "RETRY_MAX_S", 0.2)
    intercom_sync.SYNC.reset()
    wbf.FEED.reset()
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t", ha_core_url="http://ha.local:8123")
    app = create_app(s)
    c = TestClient(app)
    bind(c, s, "root", "system_admin", "installation", "*")
    bind(c, s, "vera", "viewer", "installation", "*")
    yield fake, app, s, c, wbf
    wbf.FEED.shutdown()
    intercom_sync.SYNC.shutdown()
    for thread in (wbf.FEED.thread, intercom_sync.SYNC.thread):
        if thread is not None:
            thread.join(timeout=5)
    wbf.FEED.reset()
    intercom_sync.SYNC.reset()


def wait_for(pred: Any, timeout: float = 5.0) -> None:
    end = time.time() + timeout
    while time.time() < end:
        if pred():
            return
        time.sleep(0.02)
    raise AssertionError(f"condition not met; feed state {intercom_sync.STATE.as_dict()}")


def test_schema_drift_never_reaches_the_entry_center_or_the_background_projection(wiskey):
    fake, _app, s, c, _wbf = wiskey
    fake.drift = True
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    body = c.get("/api/v1/intercom/overview", headers=as_user("vera")).json()
    assert body["state"] == "ready"
    text = json.dumps(body, ensure_ascii=False)
    assert "x_unknown" not in text and "teleporting" not in text and not any(m in text for m in PERSON_MARKERS)
    assert {st["call_state"] for st in body["overview"]["stations"]} == {"unknown"}, "an unknown enum value is unknown"
    assert {st["sync_state"] for st in body["overview"]["stations"]} == {"unknown"} and "quantum" not in text, "the sync state too (CR-036 S4 regression)"
    assert all(st["last_seen"] is None for st in body["overview"]["stations"]), "a dropped field is absent, not invented"
    bg = c.get("/api/v1/intercom/background", headers=as_user("vera")).json()
    wiskey_background.assert_closed(bg["projection"])
    assert "x_unknown" not in json.dumps(bg) and bg["identity"] == "service" and bg["split"] is False


def test_an_offline_station_is_shown_offline_and_a_release_to_it_is_refused(wiskey):
    fake, _app, s, c, _wbf = wiskey
    fake.set_offline("entry-c")
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    stations = {st["id"]: st for st in c.get("/api/v1/intercom/overview", headers=as_user("root")).json()["overview"]["stations"]}
    assert stations["entry-c"]["online"] is False and stations["entry-c"]["call_state"] == "unavailable"
    from test_intercom import env

    r = c.post("/api/v1/intercom/stations/entry-c/release", headers=as_user("root"), json=env(lock=1, confirmed=True))
    assert r.status_code >= 400, r.text
    assert ("stations/test_unlock", "station_offline") in fake.answered or "stations/test_unlock" not in fake.commands_sent(), "refused by WisKey or before sending"


def test_a_forbidden_service_account_is_the_forbidden_state_and_serves_nothing(wiskey):
    fake, _app, s, c, _wbf = wiskey
    fake.set_forbidden(True)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "forbidden")
    body = c.get("/api/v1/intercom/overview", headers=as_user("root")).json()
    assert body["state"] == "forbidden" and body["overview"] is None


def test_a_stale_people_page_is_reported_as_stale(wiskey):
    fake, _app, s, c, _wbf = wiskey
    fake.stale_revision = True
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    body = c.get("/api/v1/intercom/people", headers=as_user("root")).json()
    assert body["state"] == "ready", body
    assert json.dumps(body).count('"stale": true') >= 1, "WisKey's stale flag reaches the caller, who restarts at page one"


def test_a_slow_wiskey_times_out_a_read_without_changing_the_feed_state(wiskey, monkeypatch):
    fake, _app, s, c, _wbf = wiskey
    monkeypatch.setattr(intercom_sync, "COMMAND_TIMEOUT_S", 0.2)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    fake.slow, fake.slow_commands = 1.0, {"users/get"}
    body = c.get("/api/v1/intercom/people/u1", headers=as_user("root")).json()
    assert body["person"] is None and body["last_error"] == "timeout", body
    assert intercom_sync.STATE.state == "ready"


def test_the_split_background_session_against_the_fake(wiskey):
    fake, _app, s, c, wbf = wiskey
    s2 = replace(s, wiskey_background_token="bg-token")
    intercom_sync.SYNC.start(s2)
    wbf.FEED.start(s2)
    wait_for(lambda: wbf.FEED.status["state"] == "ready" and intercom_sync.STATE.state == "ready")
    view = wbf.channel_view(s2)
    assert view["identity"] == "background" and view["split"] is True
    wiskey_background.assert_closed(view["projection"])
    assert [st["id"] for st in view["projection"]["stations"]] == ["entry-a", "entry-b", "entry-c"]
    bg_socket = next(sock for sock in fake.sockets if sock.token == "bg-token")
    sent = [m["type"][len(PREFIX):] for m in bg_socket.sent if str(m.get("type", "")).startswith(PREFIX)]
    assert set(sent) <= {"overview", "subscribe"}, sent
    # a refresh push on the background session refetches; access revoked drops the copy
    before = wbf.FEED.status["refreshes"]
    assert fake.push("refresh") >= 1
    wait_for(lambda: wbf.FEED.status["refreshes"] > before)
    fake.identities["bg-token"]["allowed"] = False
    fake.push("access_revoked")
    wait_for(lambda: wbf.FEED.status["state"] == "forbidden")
    assert wbf.channel_view(s2)["projection"] is None


def test_separate_handlers_listed_by_the_fake_match_the_contract_test():
    from test_wiskey_contract import SEPARATE_HANDLERS as CONTRACT_SEPARATE

    assert set(SEPARATE_HANDLERS) == CONTRACT_SEPARATE
