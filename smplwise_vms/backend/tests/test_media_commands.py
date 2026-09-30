"""CR-015: the one command path - `POST /multimedia/devices/{key}/commands`. Every command becomes exactly one signed bridge call to the
primary endpoint with the profile's code, as the caller's own HA user; every refusal is audited and sends nothing. Capabilities, profile,
public screens, off / unavailable screens, the bridge version, rate limits (server side), the power rules, idempotency, expiry, and the
text that is never stored."""
from __future__ import annotations

import datetime as dt
import json
from typing import Any

import media_seed as seed
import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from media_seed import body, send, service_of

from smplwise.main import create_app
from smplwise.services import ha_client, media_commands


@pytest.fixture()
def m(settings, monkeypatch):
    app = create_app(settings)
    c = TestClient(app)
    seed.install(c)
    seed.approve_all(c)
    calls = seed.pair(c, monkeypatch)
    media_commands.BUCKETS.clear()
    media_commands._KEY_WINDOWS.clear()
    media_commands._LIMIT_WINDOWS.clear()
    keys = {n: seed.key_of(c, e) for n, e in {"samsung": "media_player.tv_living", "kitchen": "media_player.tv_kitchen", "lg": "media_player.lg_office", "lg_off": "media_player.lg_storage",
                                               "android": "media_player.tv_bedroom", "generic": "media_player.generic_tv"}.items()}
    return app, c, calls, keys, settings


def audit_rows(app, action: str | None = None) -> list[dict[str, Any]]:
    with app.state.db.connection(mode="read") as conn:
        sql = "SELECT * FROM audit_log" + (" WHERE action = ?" if action else "") + " ORDER BY id"
        return [dict(r) for r in conn.execute(sql, (action,) if action else ()).fetchall()]


def code(r) -> str:
    return r.json()["code"]


# ------------------------------------------------------------------------------------------------ power


def test_power_on_is_turn_on_on_the_power_endpoint_as_the_callers_own_ha_user(m):
    app, c, calls, keys, _ = m
    r = send(c, keys["kitchen"], "power_on")
    assert r.status_code == 202, r.text
    out = r.json()
    assert out["status"] == "accepted" and out["confirm"] == "state" and out["error"] is None and out["action_id"] and out["command_id"]
    assert [service_of(p) for p in calls] == [("media_player", "turn_on", {"entity_id": "media_player.tv_kitchen"})]
    assert calls[0]["user_id"] == "dev-joni" and calls[0]["request_id"] == out["action_id"], "HA decides by the caller's own user"
    # the confirmation poll is the existing action route: confirmed once HA reports the screen on
    assert c.get(f"/api/v1/ha/actions/{out['action_id']}").json()["status"] == "pending"
    seed.set_state(c, "media_player.tv_kitchen", "on")
    polled = c.get(f"/api/v1/ha/actions/{out['action_id']}").json()
    assert polled["status"] == "confirmed" and polled["action_id"] == "media_player.turn_on"


def test_power_on_is_confirmed_by_a_playing_screen_too(m):
    app, c, calls, keys, _ = m
    out = send(c, keys["kitchen"], "power_on").json()
    seed.set_state(c, "media_player.tv_kitchen", "playing")
    assert c.get(f"/api/v1/ha/actions/{out['action_id']}").json()["status"] == "confirmed"


def test_power_off_and_the_state_rules(m):
    app, c, calls, keys, _ = m
    r = send(c, keys["samsung"], "power_off")
    assert r.status_code == 202 and service_of(calls[-1]) == ("media_player", "turn_off", {"entity_id": "media_player.tv_living"})
    assert code(send(c, keys["kitchen"], "power_off")) == "screen_off", "off already"
    assert send(c, keys["kitchen"], "power_off").status_code == 409
    assert code(send(c, keys["generic"], "power_on")) == "not_supported", "already on"
    assert code(send(c, keys["lg_off"], "power_on")) == "unavailable", "an unavailable screen takes nothing, not even power-on"
    assert len(calls) == 1


def test_a_screen_without_remote_wake_refuses_power_on_with_not_supported(m):
    app, c, calls, keys, _ = m
    seed.set_state(c, "media_player.lg_office", "off", supported_features=seed.ALL & ~seed.TURN_ON)
    r = send(c, keys["lg"], "power_on")
    assert r.status_code == 422 and code(r) == "not_supported" and calls == []
    assert c.get(f"/api/v1/multimedia/devices/{keys['lg']}").json()["caps"]["power_on_reason"] == "no_remote_wake"


def test_one_power_command_in_flight_and_two_seconds_between_them(m, monkeypatch):
    app, c, calls, keys, _ = m
    clock = {"ms": 1_000_000}
    monkeypatch.setattr(media_commands, "NOW_MS", lambda: clock["ms"])
    assert send(c, keys["kitchen"], "power_on").status_code == 202
    assert code(send(c, keys["kitchen"], "power_off")) == "power_pending", "a second power command within 2 s"
    clock["ms"] += 3000  # 3 s later the first is still unconfirmed and inside its 8 s window: still in flight
    r = send(c, keys["kitchen"], "power_off")
    assert r.status_code == 409 and code(r) == "power_pending"
    clock["ms"] += 6000  # 9 s: the window has passed
    seed.set_state(c, "media_player.tv_kitchen", "on")
    assert send(c, keys["kitchen"], "power_off").status_code == 202
    assert len(calls) == 2
    # another device is not blocked by this one
    assert send(c, keys["samsung"], "power_off").status_code == 202


def test_a_confirmed_power_command_frees_the_device_after_the_gap(m, monkeypatch):
    app, c, calls, keys, _ = m
    clock = {"ms": 5_000_000}
    monkeypatch.setattr(media_commands, "NOW_MS", lambda: clock["ms"])
    out = send(c, keys["kitchen"], "power_on").json()
    seed.set_state(c, "media_player.tv_kitchen", "on")
    clock["ms"] += 2500
    assert send(c, keys["kitchen"], "power_off").status_code == 202, "confirmed and more than 2 s ago"
    assert out["action_id"]


def test_the_state_stays_unconfirmed_until_the_screen_reports_after_a_power_command(m):
    app, c, calls, keys, _ = m
    assert c.get(f"/api/v1/multimedia/devices/{keys['samsung']}").json()["live"]["confirmed"] is True
    send(c, keys["samsung"], "power_off")
    live = c.get(f"/api/v1/multimedia/devices/{keys['samsung']}").json()["live"]
    assert live["confirmed"] is False, "nothing reported since our command"
    seed.set_state(c, "media_player.tv_living", "off")
    with app.state.db.connection() as conn:  # HA's own report, a moment after the command
        conn.execute("UPDATE ha_entities SET last_updated = '2099-01-01T00:00:00+00:00' WHERE entity_id = 'media_player.tv_living'")
    live = c.get(f"/api/v1/multimedia/devices/{keys['samsung']}").json()["live"]
    assert live["power"] == "off" and live["confirmed"] is True


def test_art_mode_takes_only_power(m):
    app, c, calls, keys, _ = m
    seed.set_state(c, "media_player.tv_living", "on", art_mode_status="on")
    assert c.get(f"/api/v1/multimedia/devices/{keys['samsung']}").json()["live"]["power"] == "art"
    assert code(send(c, keys["samsung"], "key", key="up")) == "screen_off"
    assert code(send(c, keys["samsung"], "volume_set", level=10)) == "screen_off"
    assert send(c, keys["samsung"], "power_off").status_code == 202, "full off from art mode"
    assert len(calls) == 1


# ------------------------------------------------------------------------------------------------ volume, mute


def test_volume_set_converts_to_ha_units_and_clamps_to_the_ceiling(m, monkeypatch):
    app, c, calls, keys, _ = m
    assert send(c, keys["samsung"], "volume_set", level=50).status_code == 202
    assert service_of(calls[-1]) == ("media_player", "volume_set", {"entity_id": "media_player.tv_living", "volume_level": 0.5})
    assert c.put(f"/api/v1/multimedia/admin/devices/{keys['samsung']}", json={"volume_max": 40}).status_code == 200
    media_commands.BUCKETS.clear()
    send(c, keys["samsung"], "volume_set", level=90)
    assert calls[-1]["data"]["volume_level"] == 0.4, "the ceiling clamps, it does not refuse"
    for bad in (-1, 101, "x", True, None):
        media_commands.BUCKETS.clear()  # a malformed request counts against the rate limits too (they run before validation)
        r = send(c, keys["samsung"], "volume_set", level=bad) if bad is not None else send(c, keys["samsung"], "volume_set")
        assert r.status_code == 422, bad
    media_commands.BUCKETS.clear()
    assert send(c, keys["samsung"], "volume_set", level=5.5).status_code == 202


def test_volume_set_is_not_supported_where_the_endpoint_has_no_slider(m):
    app, c, calls, keys, _ = m
    r = send(c, keys["lg"], "volume_set", level=30)
    assert r.status_code == 422 and code(r) == "not_supported", "LG on an external output: no slider"
    assert send(c, keys["generic"], "volume_set", level=30).status_code == 202
    # an Android TV sets the volume through its Cast copy
    assert send(c, keys["android"], "volume_set", level=20).status_code == 202
    assert service_of(calls[-1])[2]["entity_id"] == "media_player.tv_bedroom_cast"


def test_volume_step_uses_the_entitys_step_else_the_profile_key(m):
    app, c, calls, keys, _ = m
    assert send(c, keys["samsung"], "volume_step", direction="up").status_code == 202
    out = send(c, keys["samsung"], "volume_step", direction="down").json()
    assert [service_of(p)[:2] for p in calls] == [("media_player", "volume_up"), ("media_player", "volume_down")]
    assert out["status"] == "sent" and out["action_id"] is None and out["confirm"] == "none"
    # a screen whose media_player has no VOLUME_STEP bit steps with the profile's own key
    seed.set_state(c, "media_player.tv_kitchen", "on", supported_features=seed.ALL & ~seed.VOLUME_STEP)
    media_commands.BUCKETS.clear()
    assert send(c, keys["kitchen"], "volume_step", direction="up").status_code == 202
    assert service_of(calls[-1]) == ("media_player", "play_media", {"entity_id": "media_player.tv_kitchen", "media_content_type": "send_key", "media_content_id": "KEY_VOLUP"})
    assert code(send(c, keys["samsung"], "volume_step", direction="sideways")) == "validation"


def test_mute_is_volume_mute_with_the_flag_and_is_confirmed_by_the_attribute(m):
    app, c, calls, keys, _ = m
    out = send(c, keys["samsung"], "mute", muted=True).json()
    assert service_of(calls[-1]) == ("media_player", "volume_mute", {"entity_id": "media_player.tv_living", "is_volume_muted": True})
    assert out["confirm"] == "attribute" and out["status"] == "accepted"
    assert c.get(f"/api/v1/ha/actions/{out['action_id']}").json()["status"] == "pending"
    seed.set_state(c, "media_player.tv_living", "playing", is_volume_muted=True)
    assert c.get(f"/api/v1/ha/actions/{out['action_id']}").json()["status"] == "confirmed"
    assert code(send(c, keys["samsung"], "mute", muted="yes")) == "validation"


def test_the_linked_receiver_takes_volume_and_mute_by_target(m):
    app, c, calls, keys, _ = m
    rcv = seed.key_of(c, "media_player.receiver_living")
    assert c.put(f"/api/v1/multimedia/admin/devices/{keys['samsung']}", json={"audio_link_key": rcv, "audio_default": "linked"}).status_code == 200
    detail = c.get(f"/api/v1/multimedia/devices/{keys['samsung']}").json()
    assert detail["audio_link"] == {"key": rcv, "name": "מגבר סלון", "default": "linked"} and detail["live"]["volume"]["target"] == "linked" and detail["live"]["volume"]["level"] == 40
    send(c, keys["samsung"], "volume_set", level=25)
    assert service_of(calls[-1])[2] == {"entity_id": "media_player.receiver_living", "volume_level": 0.25}
    send(c, keys["samsung"], "mute", muted=False, target="screen")
    assert service_of(calls[-1])[2]["entity_id"] == "media_player.tv_living", "an explicit target wins"
    media_commands.BUCKETS.clear()
    assert code(send(c, keys["generic"], "volume_set", level=10, target="linked")) == "not_supported", "no receiver linked to this screen"
    assert code(send(c, keys["samsung"], "volume_set", level=10, target="everywhere")) == "validation"


def test_lg_on_an_external_output_with_a_receiver_sends_volume_to_the_receiver(m):
    app, c, calls, keys, _ = m
    rcv = seed.key_of(c, "media_player.receiver_living")
    c.put(f"/api/v1/multimedia/admin/devices/{keys['lg']}", json={"audio_link_key": rcv})
    detail = c.get(f"/api/v1/multimedia/devices/{keys['lg']}").json()
    assert detail["live"]["volume"]["target"] == "linked" and detail["caps"]["volume_set"] is True
    assert send(c, keys["lg"], "volume_set", level=33).status_code == 202 and service_of(calls[-1])[2]["entity_id"] == "media_player.receiver_living"


# ------------------------------------------------------------------------------------------------ sources, apps, sound output, transport


def test_source_sends_the_tvs_own_string_and_only_visible_curated_sources(m):
    app, c, calls, keys, _ = m
    out = send(c, keys["samsung"], "source", source_id="HDMI1").json()
    assert service_of(calls[-1]) == ("media_player", "select_source", {"entity_id": "media_player.tv_living", "source": "HDMI1"}) and out["confirm"] == "attribute"
    assert code(send(c, keys["samsung"], "source", source_id="HDMI9")) == "not_supported"
    assert code(send(c, keys["samsung"], "source", source_id="Netflix")) == "not_supported", "an app is not a source"
    # hidden by the curation: refused, and the TV's own string is what the curation keys on
    r = c.put(f"/api/v1/multimedia/devices/{keys['samsung']}/remote", json={"remote": None, "sources": [{"id": "HDMI2", "label": "HDMI 2 · ממיר", "hidden": True, "kind": "source", "glyph": None}]})
    assert r.status_code == 200, r.text
    assert code(send(c, keys["samsung"], "source", source_id="HDMI2")) == "not_supported"
    assert send(c, keys["samsung"], "source", source_id="TV").status_code == 202
    assert code(send(c, keys["android"], "source", source_id="HDMI1")) == "not_supported", "an Android TV has no source list"


def test_app_is_select_source_on_samsung_and_lg_and_an_activity_on_android(m):
    app, c, calls, keys, _ = m
    send(c, keys["samsung"], "app", app_id="YouTube")
    assert service_of(calls[-1]) == ("media_player", "select_source", {"entity_id": "media_player.tv_living", "source": "YouTube"})
    send(c, keys["lg"], "app", app_id="Netflix")
    assert service_of(calls[-1]) == ("media_player", "select_source", {"entity_id": "media_player.lg_office", "source": "Netflix"})
    out = send(c, keys["android"], "app", app_id="https://www.youtube.com").json()
    assert service_of(calls[-1]) == ("remote", "turn_on", {"entity_id": "remote.tv_bedroom", "activity": "https://www.youtube.com"}) and out["confirm"] == "attribute"
    assert code(send(c, keys["android"], "app", app_id="evil://")) == "not_supported"
    assert code(send(c, keys["generic"], "app", app_id="YouTube")) == "not_supported"


def test_sound_output_is_lgs_own_action(m):
    app, c, calls, keys, _ = m
    assert send(c, keys["lg"], "sound_output", output="tv_speaker").status_code == 202
    assert service_of(calls[-1]) == ("webostv", "select_sound_output", {"entity_id": "media_player.lg_office", "sound_output": "tv_speaker"})
    assert code(send(c, keys["lg"], "sound_output", output="bluetooth")) == "not_supported"
    assert code(send(c, keys["samsung"], "sound_output", output="tv_speaker")) == "not_supported"


@pytest.mark.parametrize("action,service,confirm", [("play", "media_play", "state"), ("pause", "media_pause", "state"), ("play_pause", "media_play_pause", "none"), ("stop", "media_stop", "none"),
                                                   ("next", "media_next_track", "none"), ("previous", "media_previous_track", "none")])
def test_transport(m, action, service, confirm):
    app, c, calls, keys, _ = m
    out = send(c, keys["samsung"], "transport", action=action).json()
    assert service_of(calls[-1]) == ("media_player", service, {"entity_id": "media_player.tv_living"}) and out["confirm"] == confirm
    assert out["status"] == ("accepted" if confirm != "none" else "sent")


def test_transport_follows_the_caps(m):
    app, c, calls, keys, _ = m
    assert code(send(c, keys["generic"], "transport", action="next")) == "not_supported"
    assert send(c, keys["generic"], "transport", action="play_pause").status_code == 202
    assert code(send(c, keys["samsung"], "transport", action="rewind")) == "validation"


# ------------------------------------------------------------------------------------------------ keys and text


@pytest.mark.parametrize("which,key,expect", [
    ("samsung", "up", ("media_player", "play_media", {"entity_id": "media_player.tv_living", "media_content_type": "send_key", "media_content_id": "KEY_UP"})),
    ("samsung", "ok", ("media_player", "play_media", {"entity_id": "media_player.tv_living", "media_content_type": "send_key", "media_content_id": "KEY_ENTER"})),
    ("samsung", "chlist", ("media_player", "play_media", {"entity_id": "media_player.tv_living", "media_content_type": "send_key", "media_content_id": "KEY_CH_LIST"})),
    ("lg", "ok", ("webostv", "button", {"entity_id": "media_player.lg_office", "button": "ENTER"})),
    ("lg", "n7", ("webostv", "button", {"entity_id": "media_player.lg_office", "button": "7"})),
    ("android", "ok", ("remote", "send_command", {"entity_id": "remote.tv_bedroom", "command": "DPAD_CENTER"})),
    ("android", "chup", ("remote", "send_command", {"entity_id": "remote.tv_bedroom", "command": "CHANNEL_UP"})),
    ("android", "blue", ("remote", "send_command", {"entity_id": "remote.tv_bedroom", "command": "PROG_BLUE"})),
])
def test_a_key_goes_through_the_profiles_transport_with_its_code(m, which, key, expect):
    app, c, calls, keys, _ = m
    r = send(c, keys[which], "key", key=key)
    assert r.status_code == 202, r.text
    assert r.json()["status"] == "sent" and r.json()["action_id"] is None and r.json()["confirm"] == "none"
    assert service_of(calls[-1]) == expect


def test_keys_outside_the_profile_are_refused_and_a_generic_screen_has_none(m):
    app, c, calls, keys, _ = m
    assert code(send(c, keys["generic"], "key", key="up")) == "not_supported"
    assert code(send(c, keys["samsung"], "key", key="blue")) == "not_supported", "KEY_CYAN stays off until verified"
    assert code(send(c, keys["lg"], "key", key="rew")) == "not_supported"
    assert code(send(c, keys["lg"], "key", key="tools")) == "not_supported"
    assert code(send(c, keys["samsung"], "key", key="power")) == "validation" and code(send(c, keys["samsung"], "key", key="KEY_POWER")) == "validation"
    assert calls == []
    # enabled for this one screen in settings: sent with its model code
    assert c.put(f"/api/v1/multimedia/admin/devices/{keys['samsung']}", json={"model_keys": ["blue"]}).status_code == 200
    assert send(c, keys["samsung"], "key", key="blue").status_code == 202 and calls[-1]["data"]["media_content_id"] == "KEY_CYAN"
    assert c.put(f"/api/v1/multimedia/admin/devices/{keys['lg']}", json={"model_keys": ["rew"]}).status_code == 422


def test_no_command_can_name_a_power_key_whatever_the_body(m):
    app, c, calls, keys, _ = m
    for bad in ({"command": "key", "key": "KEY_POWER"}, {"command": "key", "key": "KEY_POWEROFF"}, {"command": "key", "key": "power"}, {"command": "text", "text": "x", "key": "power"},
                {"command": "power_toggle"}, {"command": "transport", "action": "power"}):
        r = c.post(f"/api/v1/multimedia/devices/{keys['samsung']}/commands", json={**body(bad["command"]), **{k: v for k, v in bad.items() if k != "command"}})
        assert r.status_code == 422, bad
    assert calls == []


def test_text_is_sent_per_profile_and_never_stored_or_logged(m):
    app, c, calls, keys, _ = m
    secret_text = "סיסמה-1234-XYZ"
    assert send(c, keys["samsung"], "text", text=secret_text).status_code == 202
    assert service_of(calls[-1]) == ("media_player", "play_media", {"entity_id": "media_player.tv_living", "media_content_type": "send_text", "media_content_id": secret_text})
    media_commands.BUCKETS.clear()
    assert send(c, keys["android"], "text", text="hello").status_code == 202
    assert service_of(calls[-1]) == ("remote", "send_command", {"entity_id": "remote.tv_bedroom", "command": "text:hello"})
    assert code(send(c, keys["lg"], "text", text="hello")) == "not_supported"
    assert code(send(c, keys["generic"], "text", text="hello")) == "not_supported"
    for bad in ("", "x" * 201, "a\nb"):
        media_commands.BUCKETS.clear()  # (a malformed request counts against the rate limits too: they run before validation)
        assert code(send(c, keys["samsung"], "text", text=bad)) == "validation"
    media_commands.BUCKETS.clear()
    assert send(c, keys["samsung"], "text", text="x" * 200).status_code == 202
    with app.state.db.connection(mode="read") as conn:
        for table in ("audit_log", "media_commands", "ha_actions"):
            dump = json.dumps([dict(r) for r in conn.execute(f"SELECT * FROM {table}").fetchall()], ensure_ascii=False)
            assert secret_text not in dump and "hello" not in dump, f"typed text found in {table}"
    lengths = [json.loads(r["details_json"])["length"] for r in audit_rows(app, "media.text")]
    assert lengths[:2] == [len(secret_text), 5], "only the length is audited"


# ------------------------------------------------------------------------------------------------ refusals


def test_a_screen_that_is_off_or_unavailable_takes_no_keys_volume_or_sources(m):
    app, c, calls, keys, _ = m
    for cmd, fields in (("key", {"key": "up"}), ("volume_set", {"level": 10}), ("volume_step", {"direction": "up"}), ("mute", {"muted": True}), ("source", {"source_id": "TV"}), ("app", {"app_id": "YouTube"}),
                        ("transport", {"action": "pause"}), ("text", {"text": "x"})):
        r = send(c, keys["kitchen"], cmd, **fields)
        assert (r.status_code, code(r)) == (409, "screen_off"), cmd
    assert code(send(c, keys["lg_off"], "key", key="up")) == "unavailable"
    assert calls == []
    seed.set_state(c, "media_player.tv_kitchen", "standby")
    assert code(send(c, keys["kitchen"], "key", key="up")) == "screen_off"


def test_the_bridge_must_be_paired_and_at_least_0_4_0(settings, monkeypatch):
    app = create_app(settings)
    c = TestClient(app)
    seed.install(c)
    seed.approve_all(c)
    key = seed.key_of(c, "media_player.tv_living")
    r = send(c, key, "key", key="up")
    assert (r.status_code, code(r)) == (503, "bridge_not_paired")
    calls = seed.pair(c, monkeypatch, version="0.3.1")
    r = send(c, key, "key", key="up")
    assert (r.status_code, code(r)) == (503, "bridge_outdated") and r.json()["user_message"] == "נדרש עדכון של רכיב החיבור"
    assert c.get("/api/v1/multimedia/status").json()["bridge"] == {"paired": True, "version": "0.3.1", "media_ready": False}
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    from smplwise.services import ha_bridge

    c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.4.0"}))
    assert send(c, key, "key", key="up").status_code == 202 and len(calls) == 1
    assert c.get("/api/v1/multimedia/status").json()["bridge"]["media_ready"] is True


def test_a_bridge_answer_of_no_is_refused_with_its_code_and_is_audited(settings, monkeypatch):
    app = create_app(settings)
    c = TestClient(app)
    seed.install(c)
    seed.approve_all(c)
    key = seed.key_of(c, "media_player.tv_kitchen")
    seed.pair(c, monkeypatch, result={"ok": False, "error": "unauthorized"})
    r = send(c, key, "power_on")
    assert r.status_code == 200 and r.json()["status"] == "refused" and r.json()["error"] == "ha_unauthorized"
    rows = audit_rows(app, "media.command")
    assert rows[-1]["decision"] == "denied" and rows[-1]["reason"] == "ha_unauthorized"
    # a refused command does not block the next power command of the device
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT status, error FROM media_commands").fetchone()["status"] == "refused"


def test_an_unreachable_ha_is_a_503_with_the_record_marked_refused(settings, monkeypatch):
    from smplwise.errors import ApiError

    app = create_app(settings)
    c = TestClient(app)
    seed.install(c)
    seed.approve_all(c)
    key = seed.key_of(c, "media_player.tv_living")
    seed.pair(c, monkeypatch)

    def down(_s, payload, timeout=15.0):
        raise ApiError(503, "ha_unavailable", "x", retryable=True)

    monkeypatch.setattr(ha_client, "call_bridge_execute", down)
    r = send(c, key, "key", key="up")
    assert (r.status_code, code(r)) == (503, "ha_unavailable")
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT status, error FROM media_commands").fetchone()["error"] == "ha_unavailable"


# ------------------------------------------------------------------------------------------------ envelope, idempotency, limits


def test_the_same_request_id_never_sends_twice(m):
    app, c, calls, keys, _ = m
    b = body("power_on", client_request_id="req-power-0001")
    first = c.post(f"/api/v1/multimedia/devices/{keys['kitchen']}/commands", json=b)
    second = c.post(f"/api/v1/multimedia/devices/{keys['kitchen']}/commands", json=b)
    assert first.status_code == second.status_code == 202 and first.json() == second.json() and len(calls) == 1
    k1 = body("key", key="up", client_request_id="req-key-00001")
    a = c.post(f"/api/v1/multimedia/devices/{keys['samsung']}/commands", json=k1).json()
    b2 = c.post(f"/api/v1/multimedia/devices/{keys['samsung']}/commands", json=k1).json()
    assert a == b2 and len(calls) == 2, "keys are idempotent too"


def test_an_expired_request_is_never_sent_and_a_far_expiry_is_refused(m):
    app, c, calls, keys, _ = m
    past = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    far = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
    assert (send(c, keys["samsung"], "key", key="up", expires_at=past).status_code, 409) == (409, 409)
    assert code(send(c, keys["samsung"], "key", key="up", expires_at=past)) == "expired"
    assert code(send(c, keys["samsung"], "key", key="up", expires_at=far)) == "validation"
    assert code(send(c, keys["samsung"], "key", key="up", expires_at="tomorrow")) == "validation"
    assert calls == []


def test_the_body_is_closed(m):
    app, c, calls, keys, _ = m
    url = f"/api/v1/multimedia/devices/{keys['samsung']}/commands"
    assert c.post(url, json={**body("key", key="up"), "entity_id": "media_player.tv_living"}).status_code == 422, "a client never names an entity"
    assert c.post(url, json={**body("key", key="up"), "service": "media_player.turn_off"}).status_code == 422
    assert c.post(url, json={**body("key", key="up"), "level": 5}).status_code == 422, "a field that does not belong to the command"
    assert c.post(url, data="command=key", headers={"content-type": "text/plain"}).status_code == 415
    assert c.post(url, json={"command": "key", "key": "up"}).status_code == 422, "a request id and an expiry are required"
    assert c.post(url, json={**body("key", key="up"), "client_request_id": "short"}).status_code == 422
    assert calls == []


def test_key_rate_limits_are_per_device_and_per_user_and_drop_never_queue(m, monkeypatch):
    app, c, calls, keys, _ = m
    clock = {"t": 100.0}
    monkeypatch.setattr(media_commands, "MONO", lambda: clock["t"])
    media_commands.BUCKETS.clear()
    statuses = [send(c, keys["samsung"], "key", key="volup").status_code for _ in range(9)]
    assert statuses == [202] * 8 + [429], "burst of 8 per device"
    r = send(c, keys["samsung"], "key", key="volup")
    assert r.status_code == 429 and r.json()["code"] == "rate_limited" and r.json()["user_message"] == "יותר מדי לחיצות; נסו שוב"
    assert len(calls) == 8, "a dropped press is dropped, never queued"
    clock["t"] += 1.0  # 5 tokens a second
    assert [send(c, keys["samsung"], "key", key="volup").status_code for _ in range(6)] == [202] * 5 + [429]
    # the user's own limit across devices: 10 a second
    media_commands.BUCKETS.clear()
    out = [send(c, keys[k], "key", key="up").status_code for k in ("samsung",) * 6 + ("lg",) * 6]
    assert out.count(202) == 10 and out[-2:] == [429, 429]
    # volume steps are keys too
    media_commands.BUCKETS.clear()
    assert [send(c, keys["android"], "volume_step", direction="up").status_code for _ in range(9)].count(429) == 1


def test_volume_set_is_four_a_second_and_text_one_a_second(m, monkeypatch):
    app, c, calls, keys, _ = m
    clock = {"t": 10.0}
    monkeypatch.setattr(media_commands, "MONO", lambda: clock["t"])
    media_commands.BUCKETS.clear()
    assert [send(c, keys["samsung"], "volume_set", level=10 + i).status_code for i in range(5)] == [202, 202, 202, 202, 429]
    clock["t"] += 0.5
    assert [send(c, keys["samsung"], "volume_set", level=50 + i).status_code for i in range(3)] == [202, 202, 429]
    assert [send(c, keys["samsung"], "text", text=f"a{i}").status_code for i in range(2)] == [202, 429]
    clock["t"] += 1.1
    assert send(c, keys["samsung"], "text", text="b").status_code == 202


# ------------------------------------------------------------------------------------------------ permissions, public screens, audit


def as_role(c, settings, name: str, role: str) -> dict[str, str]:
    bind(c, settings, name, role, "installation", "*")
    return as_user(name)


def test_control_and_power_are_separate_permissions_and_a_denial_is_audited(m):
    app, c, calls, keys, settings = m
    viewer = as_role(c, settings, "vera", "viewer")
    r = send(c, keys["samsung"], "key", headers=viewer, key="up")
    assert (r.status_code, code(r)) == (403, "forbidden") and r.json()["user_message"] == "אין הרשאה"
    operator = as_role(c, settings, "olga", "operator")
    assert send(c, keys["samsung"], "key", headers=operator, key="up").status_code == 202
    assert send(c, keys["samsung"], "power_off", headers=operator).status_code == 202
    # a custom role with control but no power
    role = c.post("/api/v1/access/roles", json={"name": "שליטה בלבד", "permissions": ["devices.read", "media.read", "media.control"]}).json()["id"]
    bind(c, settings, "carl", role, "installation", "*")
    carl = as_user("carl")
    assert send(c, keys["samsung"], "volume_set", headers=carl, level=10).status_code == 202
    assert code(send(c, keys["kitchen"], "power_on", headers=carl)) == "forbidden"
    assert code(send(c, keys["samsung"], "source", headers=carl, source_id="TV")) == "forbidden"
    denied = [r for r in audit_rows(app, "media.command") if r["decision"] == "denied"]
    assert {r["reason"] for r in denied} == {"forbidden"} and all(r["resource_type"] == "media_device" for r in denied) and len(denied) == 3


def test_a_public_screen_needs_media_public_for_content_and_navigation_but_not_volume_mute_or_play_pause(m):
    app, c, calls, keys, settings = m
    assert c.put(f"/api/v1/multimedia/admin/devices/{keys['samsung']}", json={"public": True}).status_code == 200
    operator = as_role(c, settings, "olga", "operator")
    for cmd, fields in (("source", {"source_id": "TV"}), ("app", {"app_id": "YouTube"}), ("text", {"text": "x"}), ("key", {"key": "up"}), ("key", {"key": "home"}),
                        ("transport", {"action": "next"}), ("transport", {"action": "stop"})):
        r = send(c, keys["samsung"], cmd, headers=operator, **fields)
        assert (r.status_code, code(r)) == (403, "public_screen"), (cmd, fields)
    assert r.json()["user_message"] == "מסך ציבורי: נדרשת הרשאה נפרדת"
    before = len(calls)
    for cmd, fields in (("volume_set", {"level": 20}), ("volume_step", {"direction": "up"}), ("mute", {"muted": True}), ("key", {"key": "volup"}), ("key", {"key": "mute"}),
                        ("transport", {"action": "play_pause"}), ("transport", {"action": "pause"}), ("power_off", {})):
        media_commands.BUCKETS.clear()
        assert send(c, keys["samsung"], cmd, headers=operator, **fields).status_code == 202, (cmd, fields)
    assert len(calls) == before + 8
    # a site administrator holds media.public; the public flag does not affect other screens
    admin = as_role(c, settings, "sam", "site_admin")
    seed.set_state(c, "media_player.tv_living", "on")
    assert send(c, keys["samsung"], "source", headers=admin, source_id="TV").status_code == 202
    assert send(c, keys["lg"], "key", headers=operator, key="up").status_code == 202
    assert [r["reason"] for r in audit_rows(app, "media.command") if r["decision"] == "denied"].count("public_screen") == 7


def test_keys_are_audited_as_one_row_per_window_with_counts_and_commands_one_row_each(m):
    app, c, calls, keys, _ = m
    for k in ("up", "up", "down", "ok"):
        assert send(c, keys["samsung"], "key", key=k).status_code == 202
    send(c, keys["lg"], "key", key="up")
    rows = audit_rows(app, "media.keys")
    by_device = {r["resource_id"]: json.loads(r["details_json"]) for r in rows}
    assert len(rows) == 2 and by_device[keys["samsung"]]["counts"] == {"up": 2, "down": 1, "ok": 1} and by_device[keys["lg"]]["counts"] == {"up": 1}
    send(c, keys["samsung"], "volume_set", level=10)
    send(c, keys["kitchen"], "power_on")
    cmds = audit_rows(app, "media.command")
    assert [json.loads(r["details_json"])["command"] for r in cmds] == ["volume_set", "power_on"]
    assert all(r["actor_user_id"] == "dev-joni" and r["decision"] == "allowed" and r["resource_type"] == "media_device" for r in cmds)
    blob = json.dumps(rows + cmds)
    assert "aa:bb" not in blob.lower() and "token" not in blob.lower() and "192.0.2" not in blob


def test_the_device_must_be_visible_and_approved(m):
    app, c, calls, keys, settings = m
    assert send(c, "0" * 32, "key", key="up").status_code == 404
    rcv = seed.key_of(c, "media_player.receiver_living")
    assert send(c, rcv, "power_on").status_code == 404, "a receiver is not a screen in 0.1.149"
    assert c.put(f"/api/v1/multimedia/admin/devices/{keys['samsung']}", json={"approved": False}).status_code == 200
    assert send(c, keys["samsung"], "key", key="up").status_code == 404
    assert calls == []


# ------------------------------------------------------------------------------------------------ the generic route


def test_the_generic_route_refuses_managed_screens_and_every_media_action(m):
    app, c, calls, keys, settings = m

    def act(entity: str, action: str, args: dict[str, Any] | None = None, headers=None):
        return c.post(f"/api/v1/ha/entities/{entity}/actions", json={"allowed_action_id": action, "arguments": args or {}, "client_request_id": f"g-{action}-{entity}"[:80], "expires_at": "2099-01-01T00:00:00Z"}, headers=headers or {})

    r = act("media_player.tv_living", "media_player.turn_off")
    assert (r.status_code, r.json()["code"]) == (409, "use_media_screen"), "a managed screen is operated from Multimedia only"
    assert act("remote.tv_living", "remote.send_command", {"command": "DPAD_UP"}).json()["code"] == "use_media_screen"
    assert act("media_player.tv_living", "media_player.play_media", {"media_content_type": "send_key", "media_content_id": "KEY_POWER"}).json()["code"] == "use_media_screen"
    # an action with `route: media` is refused even on an entity nobody manages (a receiver)
    assert act("media_player.receiver_living", "media_player.play_media", {"media_content_type": "send_key", "media_content_id": "KEY_UP"}).json()["code"] == "use_media_screen"
    assert act("media_player.receiver_living", "webostv.button", {"button": "UP"}).json()["code"] in ("use_media_screen", "action_domain_mismatch")
    assert calls == []
    # ... while an unmanaged player keeps its ordinary actions
    assert act("media_player.receiver_living", "media_player.turn_off").status_code == 202 and len(calls) == 1
    # the refusal is audited, after the permission check: a caller without control keeps the audited 403
    viewer = as_role(c, settings, "vera", "viewer")
    assert act("media_player.tv_living", "media_player.turn_off", headers=viewer).json()["code"] == "forbidden"
    assert [r["reason"] for r in audit_rows(app, "ha.action") if r["decision"] == "denied"].count("use_media_screen") == 5
    # withdrawing the approval gives the screen back to the generic route
    assert c.put(f"/api/v1/multimedia/admin/devices/{keys['samsung']}", json={"approved": False}).status_code == 200
    assert act("media_player.tv_living", "media_player.turn_off").status_code == 202


def test_the_entity_catalogue_lists_a_managed_screen_read_only(m):
    app, c, calls, keys, settings = m
    ents = {e["entity_id"]: e for e in c.get("/api/v1/ha/entities?domain=media_player").json()["entities"]}
    assert ents["media_player.tv_living"]["media_managed"] is True and ents["media_player.tv_living"]["actions"] == []
    assert ents["media_player.receiver_living"]["media_managed"] is False and ents["media_player.receiver_living"]["actions"]
    assert "media_player.play_media" not in {a["id"] for a in ents["media_player.receiver_living"]["actions"]}
    one = c.get("/api/v1/ha/entities/media_player.tv_living").json()
    assert one["media_managed"] is True and one["actions"] == []


def test_a_confirmed_source_pick_joins_the_recent_list(m):
    app, c, calls, keys, _ = m
    out = send(c, keys["samsung"], "source", source_id="HDMI2").json()
    assert c.get(f"/api/v1/multimedia/devices/{keys['samsung']}").json()["recent"] == []
    seed.set_state(c, "media_player.tv_living", "playing", source="HDMI2")
    assert c.get(f"/api/v1/ha/actions/{out['action_id']}").json()["status"] == "confirmed"
    media_commands.BUCKETS.clear()
    out = send(c, keys["samsung"], "app", app_id="YouTube").json()
    seed.set_state(c, "media_player.tv_living", "playing", source="YouTube")
    c.get(f"/api/v1/ha/actions/{out['action_id']}")
    recent = c.get(f"/api/v1/multimedia/devices/{keys['samsung']}").json()["recent"]
    assert [(r["kind"], r["id"]) for r in recent] == [("app", "YouTube"), ("source", "HDMI2")]


# ------------------------------------------------------------------------------------------------ CR-015 review fixes (M1, L3, L8, L9, L11)


def _frozen(monkeypatch) -> dict[str, float]:
    clock = {"t": 500.0}
    monkeypatch.setattr(media_commands, "MONO", lambda: clock["t"])
    media_commands.BUCKETS.clear()
    return clock


def test_every_non_power_command_has_a_device_bucket_and_a_user_bucket(m, monkeypatch):
    """M1: transport, mute, source, app and sound output were unlimited; now 3/s burst 6 per device, all commands 10/s burst 10 per user."""
    app, c, calls, keys, _ = m
    clock = _frozen(monkeypatch)
    statuses = [send(c, keys["samsung"], "transport", action="pause").status_code for _ in range(7)]
    assert statuses == [202] * 6 + [429], "burst of 6 per device for the other commands"
    for cmd, fields in (("mute", {"muted": True}), ("source", {"source_id": "TV"}), ("app", {"app_id": "YouTube"}), ("sound_output", {"output": "tv_speaker"}), ("transport", {"action": "play"})):
        r = send(c, keys["samsung"], cmd, **fields)
        assert (r.status_code, code(r)) == (429, "rate_limited") and r.json()["details"]["scope"] == "device", cmd
    assert send(c, keys["generic"], "mute", muted=True).status_code == 202, "another device has its own bucket"
    assert len(calls) == 7
    clock["t"] += 1.0  # 3 tokens a second
    assert [send(c, keys["samsung"], "transport", action="pause").status_code for _ in range(4)] == [202] * 3 + [429]
    # the user's bucket spans every non-power command and every device: 10 a second
    media_commands.BUCKETS.clear()
    out = [send(c, keys[k], "mute", muted=True).status_code for k in ("samsung",) * 5 + ("generic",) * 5 + ("android",) * 2]
    assert out.count(202) == 10 and out[-2:] == [429, 429]
    r = send(c, keys["generic"], "mute", muted=True)
    assert r.status_code == 429 and r.json()["details"]["scope"] == "user"
    # volume and text draw from the user's bucket too
    media_commands.BUCKETS.clear()
    assert [send(c, keys["samsung"], "transport", action="pause").status_code for _ in range(6)] == [202] * 6
    assert [send(c, keys["generic"], "mute", muted=True).status_code for _ in range(4)] == [202] * 4
    assert send(c, keys["samsung"], "volume_set", level=5).status_code == 429
    assert send(c, keys["android"], "text", text="a").status_code == 429


def test_power_commands_are_not_rate_limited_but_gated_by_the_power_gate(m, monkeypatch):
    app, c, calls, keys, _ = m
    _frozen(monkeypatch)
    for _ in range(12):
        media_commands.BUCKETS.take("user", "dev-joni", media_commands.USER_ALL)  # the user's bucket is empty
    assert send(c, keys["kitchen"], "power_on").status_code == 202, "power never draws from the buckets"


def test_dropped_commands_are_one_audit_row_per_user_and_device_per_window_never_one_per_429(m, monkeypatch):
    app, c, calls, keys, _ = m
    clock = _frozen(monkeypatch)
    for _ in range(6):
        send(c, keys["samsung"], "transport", action="pause")
    dropped = [send(c, keys["samsung"], "transport", action="play") if i % 2 else send(c, keys["samsung"], "mute", muted=True) for i in range(10)]
    assert {r.status_code for r in dropped} == {429}
    rows = audit_rows(app, "media.rate_limited")
    assert len(rows) == 1, "ten dropped presses, one row"
    row = rows[0]
    assert row["decision"] == "denied" and row["reason"] == "rate_limited" and row["resource_id"] == keys["samsung"] and row["actor_user_id"] == "dev-joni"
    assert json.loads(row["details_json"])["counts"] == {"mute": 5, "transport": 5}
    assert [r for r in audit_rows(app, "media.command") if r["reason"] == "rate_limited"] == [], "no per-429 media.command row"
    # another device gets its own row; the same device after the window gets a fresh one
    media_commands.BUCKETS.clear()
    for _ in range(7):
        send(c, keys["generic"], "mute", muted=True)
    assert len(audit_rows(app, "media.rate_limited")) == 2
    clock["t"] += 61.0
    media_commands.BUCKETS.clear()
    for _ in range(7):
        send(c, keys["samsung"], "transport", action="pause")
    assert len(audit_rows(app, "media.rate_limited")) == 3


def test_permission_and_rate_limit_are_decided_before_the_catalogue_is_loaded(m, monkeypatch):
    """M1: a refused or dropped command never loads the catalogue (and so never does that work under the write lock)."""
    from smplwise.services import media_store

    app, c, calls, keys, settings = m
    _frozen(monkeypatch)
    viewer = as_role(c, settings, "vera", "viewer")
    loads: list[int] = []
    real = media_store.load_catalog
    monkeypatch.setattr(media_store, "load_catalog", lambda *a, **k: (loads.append(1), real(*a, **k))[1])
    assert code(send(c, keys["samsung"], "key", headers=viewer, key="up")) == "forbidden"
    assert code(send(c, keys["samsung"], "power_off", headers=viewer)) == "forbidden"
    assert loads == [], "403 before the catalogue"
    for _ in range(6):
        assert send(c, keys["samsung"], "transport", action="pause").status_code == 202
    n = len(loads)
    assert code(send(c, keys["samsung"], "transport", action="pause")) == "rate_limited"
    assert len(loads) == n, "429 before the catalogue"


def test_the_permission_comes_before_the_body_403_before_422_and_415(m):
    """L8: a caller without control / power at the anchor gets the audited 403 whatever the body holds."""
    app, c, calls, keys, settings = m
    viewer = as_role(c, settings, "vera", "viewer")
    url = f"/api/v1/multimedia/devices/{keys['samsung']}/commands"
    assert c.post(url, json={"command": "bogus"}, headers=viewer).status_code == 403
    assert c.post(url, content="not json", headers={**viewer, "content-type": "text/plain"}).status_code == 403, "403 before 415"
    assert c.post(url, content=b"{broken", headers={**viewer, "content-type": "application/json"}).status_code == 403
    assert c.post(url, json={"command": "bogus"}).status_code == 422, "the administrator's malformed body is a 422"
    assert c.post(f"/api/v1/multimedia/devices/{'0' * 32}/commands", json={"command": "bogus"}).status_code == 404, "an unknown screen is a 404 before anything about the body"
    denied = [r for r in audit_rows(app, "media.command") if r["decision"] == "denied" and r["reason"] == "forbidden"]
    assert len(denied) == 3 and all(r["resource_id"] == keys["samsung"] for r in denied)
    # control without power: the permission of THIS command is checked once the body is known
    role = c.post("/api/v1/access/roles", json={"name": "שליטה בלבד", "permissions": ["devices.read", "media.read", "media.control"]}).json()["id"]
    bind(c, settings, "carl", role, "installation", "*")
    carl = as_user("carl")
    assert c.post(url, json={"command": "bogus"}, headers=carl).status_code == 422
    assert code(send(c, keys["samsung"], "source", headers=carl, source_id="TV")) == "forbidden"


def test_the_device_remote_route_checks_layout_before_reading_the_body(m):
    app, c, calls, keys, settings = m
    viewer = as_role(c, settings, "vera", "viewer")
    url = f"/api/v1/multimedia/devices/{keys['samsung']}/remote"
    assert c.put(url, json={"bogus": 1}, headers=viewer).status_code == 403
    assert c.put(url, content="x", headers={**viewer, "content-type": "text/plain"}).status_code == 403, "403 before 415"
    assert c.put(url, json={"bogus": 1}).status_code == 422
    assert c.put(f"/api/v1/multimedia/devices/{'0' * 32}/remote", json={"bogus": 1}).status_code == 404
    assert [r["reason"] for r in audit_rows(app, "media.remote.update") if r["decision"] == "denied"] == ["forbidden", "forbidden"]


def _insert_command(app, key: str, crid: str, status: str, action_id: str | None, user: str = "dev-joni") -> str:
    import uuid

    cid = uuid.uuid4().hex
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO media_commands(id, device_key, principal_user_id, client_request_id, command, status, action_id, created_ms, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                     (cid, key, user, crid, "volume_set", status, action_id, media_commands.NOW_MS(), "2026-10-01T00:00:00Z"))
    return cid


def test_a_duplicate_request_id_while_the_first_is_in_flight_gets_a_documented_status(m):
    """L11: the in-flight row is `pending` internally; the caller is told `accepted` (or `sent` when nothing can be confirmed), never `pending`."""
    app, c, calls, keys, _ = m
    first = _insert_command(app, keys["samsung"], "dup-request-0001", "pending", "a1b2c3d4e5f6")
    r = send(c, keys["samsung"], "volume_set", client_request_id="dup-request-0001", level=10)
    assert r.status_code == 202 and r.json()["status"] == "accepted" and r.json()["command_id"] == first and r.json()["action_id"] == "a1b2c3d4e5f6", r.text
    second = _insert_command(app, keys["samsung"], "dup-request-0002", "pending", None)
    r = send(c, keys["samsung"], "volume_set", client_request_id="dup-request-0002", level=10)
    assert r.status_code == 202 and r.json()["status"] == "sent" and r.json()["command_id"] == second and r.json()["action_id"] is None
    assert calls == [], "nothing is sent twice"
    # a settled duplicate keeps its real outcome
    done = send(c, keys["generic"], "mute", client_request_id="dup-request-0003", muted=True).json()
    again = send(c, keys["generic"], "mute", client_request_id="dup-request-0003", muted=True)
    assert again.json() == done and len(calls) == 1
    # another user's identical request id is a different request
    other = _insert_command(app, keys["samsung"], "dup-request-0004", "pending", "zzzzzzzzzzzz", user="dev-somebody")
    r = send(c, keys["samsung"], "volume_set", client_request_id="dup-request-0004", level=10)
    assert r.json()["command_id"] != other and len(calls) == 2


def test_the_generic_route_also_refuses_the_power_and_input_controls_of_a_managed_screens_device(m):
    """L3: a switch / button / select / number / remote of the HA device of an approved screen is operated from Multimedia only."""
    app, c, calls, keys, settings = m
    extra = [{"entity_id": "switch.tv_living_power", "id": "reg-sw1", "platform": "samsungtv_smart", "device_id": "d_sam", "unique_id": "u-sw1"},
             {"entity_id": "select.tv_living_input", "id": "reg-sel1", "platform": "samsungtv_smart", "device_id": "d_sam", "unique_id": "u-sel1"},
             {"entity_id": "number.tv_living_level", "id": "reg-num1", "platform": "samsungtv_smart", "device_id": "d_sam", "unique_id": "u-num1"},
             {"entity_id": "button.tv_living_menu", "id": "reg-btn1", "platform": "samsungtv_smart", "device_id": "d_sam", "unique_id": "u-btn1"},
             {"entity_id": "light.tv_living_backlight", "id": "reg-lt1", "platform": "samsungtv_smart", "device_id": "d_sam", "unique_id": "u-lt1"},
             {"entity_id": "switch.garden_pump", "id": "reg-sw2", "platform": "template", "device_id": None, "unique_id": "u-sw2"},
             {"entity_id": "switch.tv_kitchen_power", "id": "reg-sw3", "platform": "samsungtv_smart", "device_id": "d_sam2", "unique_id": "u-sw3"}]
    st = [{"entity_id": e["entity_id"], "state": "on" if e["entity_id"].startswith(("switch", "light")) else "idle",
           "attributes": {"friendly_name": e["entity_id"], **({"options": ["a", "b"]} if e["entity_id"].startswith("select") else {})}} for e in extra]
    assert c.post("/api/v1/ha/dev/states", json={"states": st}).status_code == 200
    assert c.post("/api/v1/ha/dev/registry", json={"entities": [*seed.ENTITY_REGISTRY, *extra], "devices": seed.DEVICES, "areas": seed.AREAS, "floors": seed.FLOORS}).status_code == 200

    def act(entity: str, action: str, args: dict[str, Any] | None = None, headers=None):
        return c.post(f"/api/v1/ha/entities/{entity}/actions", json={"allowed_action_id": action, "arguments": args or {}, "client_request_id": f"g-{action}-{entity}"[:80], "expires_at": "2099-01-01T00:00:00Z"}, headers=headers or {})

    for entity, action, args in (("switch.tv_living_power", "switch.turn_off", None), ("select.tv_living_input", "select.select_option", {"option": "a"}), ("number.tv_living_level", "number.set_value", {"value": 5}),
                                 ("button.tv_living_menu", "button.press", None), ("switch.tv_kitchen_power", "switch.turn_on", None)):
        r = act(entity, action, args)
        assert (r.status_code, r.json()["code"]) == (409, "use_media_screen"), entity
    assert calls == []
    # not a power / input domain, and not a device of a screen: the ordinary route
    assert act("light.tv_living_backlight", "light.turn_off").status_code == 202
    assert act("switch.garden_pump", "switch.turn_off").status_code == 202
    # read-only listing: the catalogue still lists them, flagged, without offering actions
    listing = {e["entity_id"]: e for e in c.get("/api/v1/ha/entities").json()["entities"]}
    assert listing["switch.tv_living_power"]["media_managed"] is True and listing["switch.garden_pump"]["media_managed"] is False
    assert c.get("/api/v1/ha/entities/switch.tv_living_power").json()["actions"] == []
    # withdrawing the approval gives them back
    assert c.put(f"/api/v1/multimedia/admin/devices/{keys['samsung']}", json={"approved": False}).status_code == 200
    assert act("switch.tv_living_power", "switch.turn_off").status_code == 202
