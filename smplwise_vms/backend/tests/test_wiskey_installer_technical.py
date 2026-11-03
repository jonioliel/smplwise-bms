"""WISKEY-INSTALLER-NATIVE-2400 phase 2: a station's technical settings from Arx (routers/wiskey_installer_technical.py), end to end against
the fake WisKey validated by the rc.10 extract. Nothing contacts a device.

Proven: the exact frames (`stations/technical_get` / `technical_update` key sets + `api_contract`, on the `installer` channel); the read is
projected closed (password PRESENCE booleans only, capability flags by name pattern), cached, and names the writable doors; an update
sends `expected` + only the changed fields, once, with confirmation; a relay-inversion change needs the typed station name; WisKey's
`device_unavailable` (it cannot tell "changed, reload" from "written, readback differs") is an UNKNOWN outcome, never "nothing changed";
a door outside the relay mapping is WisKey's refusal; permission, validation, offline and limits refuse before sending."""
from __future__ import annotations

from typing import Any

from conftest import as_user
from test_wiskey_installer_clock import API, audit_rows, env, frames, wx  # noqa: F401 - wx is the shared fixture

from smplwise.services import wiskey_installer as wi

DOOR1 = {"doorName": "Door 1", "openDuration": 5, "relayReverseEnabled": False}


def put(c: Any, station: str, door: int, user: str = "root", **body: Any) -> Any:
    return c.put(f"{API}/technical/stations/{station}/doors/{door}", json=env(**{"confirmed": True, **body}), headers=as_user(user))


def test_the_read_is_closed_and_names_the_writable_doors(wx):  # noqa: F811
    fake, c, _ = wx
    r = c.get(f"{API}/technical/stations/entry-a", headers=as_user("root"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["editable_doors"] == [1] and body["typed_phrase"] == "Main gate" and body["dangerous_fields"] == ["relayReverseEnabled"]
    rep = body["report"]
    assert rep["doors"][0] == {"door": 1, "values": DOOR1, "constraints": {"doorName": {"type": "text", "min": 1, "max": 32},
                                                                             "openDuration": {"type": "integer", "min": 1, "max": 255}, "relayReverseEnabled": {"type": "boolean"}}, "error": None}
    assert rep["passwords"]["public_pin_state"] == "absent" and rep["passwords"]["states"]["engineeringConfigured"] is True
    assert all(isinstance(v, (bool, type(None))) for v in rep["passwords"]["states"].values())
    assert set(frames(fake, "stations/technical_get")[-1]) == {"id", "type", "station_id", "api_contract"}
    c.get(f"{API}/technical/stations/entry-a", headers=as_user("root"))
    assert len(frames(fake, "stations/technical_get")) == 1  # cached
    c.get(f"{API}/technical/stations/entry-a?fresh=true", headers=as_user("root"))
    assert len(frames(fake, "stations/technical_get")) == 2
    assert c.get(f"{API}/technical/stations/entry-c", headers=as_user("root")).json()["editable_doors"] == []


def test_a_failed_read_says_why(wx):  # noqa: F811
    fake, c, _ = wx
    fake.fail_with["stations/technical_get"] = "device_busy"
    r = c.get(f"{API}/technical/stations/entry-a", headers=as_user("root"))
    assert r.status_code == 502 and r.json()["details"]["wiskey_code"] == "device_busy"
    assert c.get(f"{API}/technical/stations/entry-a", headers=as_user("otto")).status_code == 403
    assert c.get(f"{API}/technical/stations/nope", headers=as_user("root")).status_code == 404


def test_an_update_sends_expected_and_only_the_changes_once(wx):  # noqa: F811
    fake, c, s = wx
    r = put(c, "entry-a", 1, expected=DOOR1, changes={"openDuration": 8, "doorName": "Lobby"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["values"] == {"doorName": "Lobby", "openDuration": 8, "relayReverseEnabled": False}
    sent = frames(fake, "stations/technical_update")
    assert len(sent) == 1 and set(sent[0]) == {"id", "type", "station_id", "door", "expected", "changes", "confirmed", "api_contract"}
    assert sent[0]["expected"] == DOOR1 and sent[0]["changes"] == {"openDuration": 8, "doorName": "Lobby"} and sent[0]["confirmed"] is True
    row = audit_rows(s, "intercom.installer.technical_update")[-1]
    assert row["details"]["outcome"] == "ok" and row["details"]["door"] == 1 and row["details"]["changes"] == {"openDuration": 8, "doorName": "Lobby"}
    # the cached report now holds the readback
    view = c.get(f"{API}/technical/stations/entry-a", headers=as_user("root")).json()
    assert view["report"]["doors"][0]["values"]["doorName"] == "Lobby"


def test_relay_inversion_needs_the_typed_station_name(wx):  # noqa: F811
    fake, c, _ = wx
    r = put(c, "entry-a", 1, expected=DOOR1, changes={"relayReverseEnabled": True})
    assert r.status_code == 409 and r.json()["code"] == "typed_confirmation_required" and r.json()["details"]["expected"] == "Main gate"
    assert not frames(fake, "stations/technical_update")
    r = put(c, "entry-a", 1, expected=DOOR1, changes={"relayReverseEnabled": True}, typed_confirmation="Main gate")
    assert r.status_code == 200 and fake.doors["entry-a"][1]["relayReverseEnabled"] is True


def test_device_unavailable_is_unknown_not_nothing_changed(wx):  # noqa: F811
    fake, c, s = wx
    fake.readback_lies.add("entry-a")
    r = put(c, "entry-a", 1, expected=DOOR1, changes={"openDuration": 9})
    assert r.status_code == 504 and r.json()["details"]["outcome"] == "unknown" and r.json()["details"]["wiskey_code"] == "device_unavailable"
    assert fake.effects  # the fake did write: "unknown" was the honest answer
    assert audit_rows(s, "intercom.installer.technical_update")[-1]["details"]["outcome"] == "unknown"


def test_a_door_outside_the_relay_mapping_is_refused_and_changes_nothing(wx):  # noqa: F811
    fake, c, _ = wx
    r = put(c, "entry-a", 2, expected={"doorName": "Door 2", "openDuration": 3, "relayReverseEnabled": False}, changes={"openDuration": 4})
    assert r.status_code == 502 and r.json()["details"]["outcome"] == "refused" and r.json()["details"]["wiskey_code"] == "operation_unsupported"
    assert not fake.effects


def test_validation_and_offline_refuse_before_sending(wx):  # noqa: F811
    fake, c, _ = wx
    for changes in ({}, {"color": "red"}, {"openDuration": 300}, {"openDuration": "5"}, {"doorName": ""}, {"doorName": "a\nb"}, {"relayReverseEnabled": 1}):
        r = put(c, "entry-a", 1, expected=DOOR1, changes=changes)
        assert r.status_code == 422, (changes, r.text)
    assert put(c, "entry-a", 3, expected=DOOR1, changes={"openDuration": 4}).status_code == 422
    assert put(c, "entry-a", 1, expected=DOOR1, changes={"openDuration": 4}, confirmed=None).json()["code"] == "confirmation_required"
    r = put(c, "entry-b", 2, expected=DOOR1, changes={"openDuration": 4})
    assert r.status_code == 409 and r.json()["code"] == "intercom_station_offline"
    assert put(c, "entry-a", 1, user="otto", expected=DOOR1, changes={"openDuration": 4}).status_code == 403
    assert not frames(fake, "stations/technical_update")


def test_one_write_per_station_per_cooldown(wx):  # noqa: F811
    fake, c, _ = wx
    assert put(c, "entry-a", 1, expected=DOOR1, changes={"openDuration": 6}).status_code == 200
    r = put(c, "entry-a", 1, expected={**DOOR1, "openDuration": 6}, changes={"openDuration": 7})
    assert r.status_code == 429 and r.json()["code"] == "installer_cooldown"
    wi.LIMITS.reset()
    assert put(c, "entry-a", 1, expected={**DOOR1, "openDuration": 6}, changes={"openDuration": 7}).status_code == 200
    assert len(frames(fake, "stations/technical_update")) == 2


def test_a_stale_expected_is_unknown_and_the_device_is_untouched(wx):  # noqa: F811
    fake, c, _ = wx
    r = put(c, "entry-a", 1, expected={**DOOR1, "openDuration": 2}, changes={"openDuration": 4})
    assert r.status_code == 504 and r.json()["details"]["outcome"] == "unknown"
    assert fake.doors["entry-a"][1] == DOOR1 and not fake.effects
