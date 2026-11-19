"""CR-BE-TWINS-2440 (review 04:F20, T7 adoption): the twin helpers of the electricity / water / temperature modules are one object,
their answers are the ones the separate copies gave, and the validation errors of these files sit on the common base unchanged."""
from __future__ import annotations

import datetime as dt

import pytest

from smplwise.errors import ApiError, ServiceInvalid
from smplwise.services import (
    elevators, energy_meters, energy_sampler, energy_settings, generator_runtime, ha_sync, messaging_runtime, notify_recipients,
    temperature, temperature_alerts, temperature_explain, temperature_runtime, timeutil, water_alerts, water_meters, water_runtime,
    water_sampler, water_settings,
)

CONNECTED = [elevators.mirror_connected, temperature.mirror_connected, messaging_runtime.ws_connected, energy_sampler._connected,
             generator_runtime._connected, water_sampler._connected]


@pytest.mark.parametrize("value,expected", [(True, True), (False, False), (None, False), (1, True)])
def test_connected_is_the_feed_state_for_all_six(monkeypatch, value, expected):
    monkeypatch.setattr(ha_sync.STATE, "connected", value)
    assert ha_sync.connected() is expected
    assert [f() for f in CONNECTED] == [expected] * 6


def test_the_six_read_ha_sync_connected_at_call_time(monkeypatch):
    monkeypatch.setattr(ha_sync, "connected", lambda: "sentinel")
    assert [f() for f in CONNECTED] == ["sentinel"] * 6


def test_twins_are_one_object():
    assert water_meters._attrs is energy_meters._attrs
    assert water_meters.epoch_to_iso is energy_meters.epoch_to_iso is timeutil.iso_from_epoch_or_none
    assert water_settings.store is energy_settings.store
    assert temperature_explain._ts is temperature_runtime._ts is water_runtime._ts is timeutil.epoch_or_none
    assert temperature_alerts._rec_of is water_alerts._rec_of is notify_recipients.as_lists


def _old_epoch_to_iso(ts):
    if ts is None:
        return None
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


@pytest.mark.parametrize("ts", [None, 0, 1, 1763200000, 1763200000.4, 1763200000.9999996, 4102444800])
def test_epoch_to_iso_answers_as_the_old_copies(ts):
    assert energy_meters.epoch_to_iso(ts) == _old_epoch_to_iso(ts)


@pytest.mark.parametrize("row,expected", [
    ({"attributes_json": '{"state_class": "total"}'}, {"state_class": "total"}),
    ({"attributes_json": None}, {}), ({"attributes_json": ""}, {}), ({"attributes_json": "[1]"}, {}), ({"attributes_json": "{bad"}, {}),
    ({}, {}), ({"attributes_json": 5}, {}),
])
def test_attrs_table(row, expected):
    assert water_meters._attrs(row) == expected


@pytest.mark.parametrize("iso,expected", [
    (None, None), ("", None), ("garbage", None), ("2026-11-16T10:00:00", None),   # no zone: refused by parse_utc, so None
    ("2026-11-16T10:00:00Z", 1794823200.0), ("2026-11-16T12:00:00+02:00", 1794823200.0),
])
def test_ts_table(iso, expected):
    assert water_runtime._ts(iso) == expected


@pytest.mark.parametrize("rec,expected", [
    (None, {"roles": [], "users": [], "groups": []}), ("x", {"roles": [], "users": [], "groups": []}),
    ({"roles": ["a", 1, None], "users": None, "extra": ["z"]}, {"roles": ["a"], "users": [], "groups": []}),
    ({"roles": ["r"], "users": ["u"], "groups": ["g"]}, {"roles": ["r"], "users": ["u"], "groups": ["g"]}),
])
def test_rec_of_table(rec, expected):
    assert water_alerts._rec_of(rec) == expected


def test_store_writes_each_key(monkeypatch):
    seen = []
    monkeypatch.setattr(energy_settings, "set_setting", lambda conn, k, v: seen.append((conn, k, v)))
    water_settings.store("conn", {"a": "1", "b": "2"})
    assert seen == [("conn", "a", "1"), ("conn", "b", "2")]


def test_temperature_invalid_keeps_its_shape_on_the_common_base():
    e = temperature.Invalid("rule_invalid", ["rules.high"])
    assert isinstance(e, ServiceInvalid) and isinstance(e, ValueError)
    assert (str(e), e.args, e.code, e.fields) == ("rule_invalid", ("rule_invalid",), "rule_invalid", ["rules.high"])
    assert temperature.Invalid("x").fields == []
    api = e.to_api_error("טקסט")
    assert isinstance(api, ApiError) and (api.status, api.code, api.details) == (422, "rule_invalid", {"fields": ["rules.high"]})


@pytest.mark.parametrize("mod", [temperature_alerts, water_alerts])
def test_alerts_invalid_keeps_its_shape_on_the_common_base(mod):
    e = mod.AlertsInvalid("channel", "ערוץ לא זמין.", "This channel is not available.", {"fields": ["escalation.channels"]})
    assert isinstance(e, ServiceInvalid) and isinstance(e, ValueError)
    assert (str(e), e.args, e.code, e.message, e.message_en, e.details) == (
        "channel", ("channel",), "channel", "ערוץ לא זמין.", "This channel is not available.", {"fields": ["escalation.channels"]})
    assert mod.AlertsInvalid("c", "m", "en").details == {}
    api = e.to_api_error()
    assert (api.status, api.code, api.details) == (422, "channel", {"fields": ["escalation.channels"]})


def test_the_two_alert_errors_stay_separate_classes():
    """A router that catches the water one must not start catching the temperature one."""
    assert temperature_alerts.AlertsInvalid is not water_alerts.AlertsInvalid
    assert not issubclass(temperature_alerts.AlertsInvalid, water_alerts.AlertsInvalid)
