"""WISKEY-TALK-DIAL-2382: the station media source choice (Arx's own source vs WisKey) - its read-only readiness check
(`GET /access-control/station-media/readiness`, services/intercom_media.py `readiness`) and the drawer's talk reasons
(`talk.reason`: `provider_local` / `pairing` / `unsupported` / `wiskey_unavailable`, `talk_gap`).

Fakes only: WisKey's discovery is the W10 fixture (`overview_api.json`), the feed is test_intercom's scripted socket, the pairing key is
patched. Nothing here contacts WisKey, a station, Home Assistant or go2rtc, and no W10 command is signed or sent."""
from __future__ import annotations

import copy
import json
import sqlite3
from pathlib import Path
from typing import Any

import pytest
from conftest import as_user, bind
from test_intercom import camera_feed, fake_go2rtc, feed  # noqa: F401 - fixtures

from smplwise.services import ha_bridge, intercom_sync
from smplwise.services import intercom_media as im

FIX = Path(__file__).parent / "fixtures" / "wiskey_w10"
READINESS = "/api/v1/access-control/station-media/readiness"
MEDIA = "/api/v1/access-control/stations/{}/media"
TALK_COMMANDS = ("media/talk_open", "media/talk_frame", "media/talk_floor", "media/talk_close")


def api(drop: tuple[str, ...] = ()) -> dict[str, Any]:
    body = copy.deepcopy(json.loads((FIX / "overview_api.json").read_text(encoding="utf-8")))
    body["commands"] = [c for c in body["commands"] if c not in drop]
    return body


def db(choice: str = "auto") -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT)")
    conn.execute("INSERT INTO settings(key, value) VALUES (?, ?)", (im.PROVIDER_KEY, choice))
    return conn


@pytest.fixture()
def wiskey(monkeypatch):
    """WisKey as the feed sees it: reachable, listing all six W10 commands, and a pairing key that signs - each changeable per test."""
    state = {"feed": "ready", "api": api(), "key": "pairing-secret-of-the-test"}
    monkeypatch.setattr(intercom_sync.SYNC, "served", lambda s: (state["feed"], {} if state["feed"] == "ready" else None))
    monkeypatch.setattr(intercom_sync.SYNC, "api_facts", lambda s: state["api"])
    monkeypatch.setattr(ha_bridge, "signing_key", lambda conn: state["key"])
    im.set_provider(None)
    yield state
    if im._bridge is not None:
        im._bridge.video.close()
        im._bridge = None
        im._bridge_for = None
    im.MEDIA.reset()


def local_descriptor() -> im.Descriptor:
    raw = {"schema": im.SCHEMA, "station_id": "entry-a", "session": "local-abcdefghijklmnop", "revision": 1,
           "issued_at": im._ts(1_800_000_000), "expires_at": im._ts(1_800_000_300),
           "video": {"profiles": [{"id": "main", "codec": "h264", "transports": ["mse"]}]}, "audio": {"listen": True, "talk": False}}
    return im.parse_descriptor(raw, station_id="entry-a", provider="local", now=1_800_000_010)


# ---------------------------------------------------------------- the readiness facts

def test_everything_in_place_means_wiskey_serves_video_and_talk(wiskey, settings):
    r = im.readiness(settings, db("auto"))
    assert r["missing"] == [] and r["active"] == "wiskey" and r["choice"] == "auto"
    assert r["video_ready"] is True and r["talk_ready"] is True
    assert r["wiskey"] == {"reachable": True, "video_listed": True, "talk_listed": True, "signing": True}
    assert "pairing-secret" not in json.dumps(r), "the key never appears in the answer"


def test_local_choice_reports_the_same_facts_but_stays_on_arx(wiskey, settings):
    r = im.readiness(settings, db("local"))
    assert r["choice"] == "local" and r["active"] == "local" and r["missing"] == [] and r["talk_ready"] is True


@pytest.mark.parametrize("change, missing", [
    ({"key": None}, ["pairing_missing"]),
    ({"key": ha_bridge.BridgeKey("rotated-material", "k-2")}, ["pairing_key_rotated"]),
    ({"api": api(drop=TALK_COMMANDS[1:2])}, ["talk_not_listed"]),
    ({"api": api(drop=("media/stream_lease",))}, ["video_not_listed", "talk_not_listed"]),
    ({"api": {**api(), "min_client": 99}}, ["api_incompatible"]),
    ({"api": {"version": None, "min_client": None, "commands": None}}, ["video_not_listed", "talk_not_listed"]),
    # lab 03.11 (WisKey 2.0.1-rc.10): 258 commands, its own media/call and media/signal among them, none of the six W10 commands
    ({"api": {"version": 1, "min_client": 0, "commands": ["overview", "media/call", "media/signal", "media/provider_check"]}},
     ["video_not_listed", "talk_not_listed"]),
    ({"feed": "ha_unavailable", "api": None}, ["wiskey_unreachable"]),
    ({"feed": "connecting", "api": None, "key": None}, ["wiskey_unreachable", "pairing_missing"]),
])
def test_each_missing_piece_is_named(wiskey, settings, change, missing):
    wiskey.update(change)
    r = im.readiness(settings, db("auto"))
    assert r["missing"] == missing
    assert set(r["missing"]) <= set(im.READINESS_CODES)
    assert r["talk_ready"] is False
    assert r["active"] == ("wiskey" if r["video_ready"] else "local")


def test_the_legacy_kid_still_signs(wiskey, settings):
    from smplwise.services import bridge_keys as bk

    wiskey["key"] = ha_bridge.BridgeKey("legacy-material", bk.LEGACY_KID)
    assert im.signing_problem(db()) is None
    assert im.signing_problem(None) == "not_paired"


def test_readiness_sends_nothing(wiskey, settings, monkeypatch):
    def boom(*a, **k):
        raise AssertionError("readiness must not build or use the signed provider")

    monkeypatch.setattr(im, "bridge_provider", boom)
    im.readiness(settings, db("auto"))


# ---------------------------------------------------------------- the talk reasons

@pytest.mark.parametrize("choice, change, reason", [
    ("local", {}, "provider_local"),
    ("auto", {"key": None}, "pairing"),
    ("auto", {"key": ha_bridge.BridgeKey("rotated-material", "k-2")}, "pairing"),
    ("auto", {"api": api(drop=TALK_COMMANDS[:1])}, "not_listed"),
    ("auto", {"api": api(drop=("media/station_descriptor",)), "key": None}, "not_listed"),
    ("auto", {"api": {"version": 1, "min_client": 0, "commands": ["overview", "media/call", "media/signal"]}}, "not_listed"),
    ("auto", {"feed": "error", "api": None}, "wiskey_unavailable"),
    ("auto", {}, "wiskey_unavailable"),  # everything in place, yet Arx's own source served: WisKey's answer failed
])
def test_a_local_descriptor_names_why_it_has_no_talk(wiskey, settings, choice, change, reason):
    wiskey.update(change)
    assert im.talk_gap(settings, db(choice), local_descriptor()) == reason


def test_a_wiskey_descriptor_without_talk_is_unsupported_or_not_listed(wiskey, settings):
    from dataclasses import replace

    d = replace(local_descriptor(), provider="wiskey")
    assert im.talk_gap(settings, db("auto"), d) == "unsupported", "WisKey lists talk: the station itself offers none"
    wiskey["api"] = api(drop=TALK_COMMANDS[2:3])
    assert im.talk_gap(settings, db("auto"), d) == "not_listed"


# ---------------------------------------------------------------- the endpoints

def test_readiness_is_for_the_system_administrator_and_a_refusal_is_audited(wiskey, client, settings):
    r = client.get(READINESS)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["choice"] == "local" and body["missing"] == [] and body["mode"] == "off"
    assert set(body) == {"choice", "active", "mode", "wiskey", "missing", "video_ready", "talk_ready"}
    bind(client, settings, "vera", "viewer", "installation", "*")
    assert client.get(READINESS, headers=as_user("vera")).status_code == 403
    assert client.get(READINESS, headers=as_user("nobody")).status_code == 403
    from smplwise.db import Database

    with Database(settings.db_path).connection(mode="read") as conn:
        rows = conn.execute("SELECT decision FROM audit_log WHERE action = 'system.configure' AND decision = 'denied'").fetchall()
    assert rows, "the refusal is on the record"


def test_the_choice_is_saved_through_settings_validated_and_audited(client, settings):
    for bad in ("wiskey", "", "AUTO"):
        assert client.patch("/api/v1/settings", json={"access.station_media_provider": bad}).status_code == 422
    r = client.patch("/api/v1/settings", json={"access.station_media_provider": "auto"})
    assert r.status_code == 200 and r.json()["settings"]["access.station_media_provider"] == "auto"
    from smplwise.db import Database

    with Database(settings.db_path).connection(mode="read") as conn:
        rows = [json.loads(x[0] or "{}") for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed'")]
    assert {"access.station_media_provider": "auto"} in rows


def test_the_drawer_names_the_missing_pairing_and_the_local_source(feed, fake_go2rtc, monkeypatch):  # noqa: F811
    c, s = camera_feed(feed)
    im.set_provider(None)
    im.MEDIA.reset()
    monkeypatch.setattr(intercom_sync.SYNC, "api_facts", lambda st: api())
    monkeypatch.setattr(ha_bridge, "signing_key", lambda conn: None)
    try:
        assert c.patch("/api/v1/settings", json={"access.station_media": "video_talk"}).status_code == 200
        body = c.get(MEDIA.format("entry-a")).json()
        assert body["state"] == "ready" and body["talk"] == {"available": False, "reason": "provider_local"}
        assert c.patch("/api/v1/settings", json={"access.station_media_provider": "auto"}).status_code == 200
        im.MEDIA.reset()
        body = c.get(MEDIA.format("entry-a")).json()
        assert body["state"] == "ready" and body["talk"] == {"available": False, "reason": "pairing"}, "no key that signs: Arx's video, and the reason"
        r = c.get(READINESS).json()
        assert r["missing"] == ["pairing_missing"] and r["active"] == "local" and r["mode"] == "video_talk"
    finally:
        if im._bridge is not None:
            im._bridge.video.close()
            im._bridge = None
            im._bridge_for = None
        im.MEDIA.reset()
