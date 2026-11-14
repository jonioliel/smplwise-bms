"""CRITSOUND124-295: the app channel's `critical_alert` relay flag (Do-Not-Disturb-bypassing sound on phones with the app) and its settings.

Server side only: the flag is sent solely for a safety / critical event type the owner chose, with the master switch on; default OFF everywhere."""
from __future__ import annotations

import pytest
from conftest import as_user
from notify_world import API, World, fake_push  # noqa: F401 - fixture
from test_mobile_push import register, relay, w  # noqa: F401 - fixtures / helpers

pytestmark = pytest.mark.usefixtures("daytime_clock")

from smplwise.services import notify_settings as ns


def _smoke(w: World, key: str = "s1") -> str:
    ent = "binary_sensor.kitchen_smoke"
    if not getattr(w, "_smoke_ready", False):
        w.entity(ent, cls="smoke", floor=w.ids["floor2"], name="גלאי עשן")
        w._smoke_ready = True
    return w.emit("sensor.smoke", "entity", ent, params={"name": "גלאי עשן"}, dedupe_key=key).id


def _app_only(w: World, source: str) -> None:
    w.set_policy(source, channels={"webpush": False, "email": False, "app": True})


def test_defaults_are_off_and_every_type_is_listed(w):
    c = w.c.get(f"{API}/notify/settings").json()["companion"]
    assert c["critical_sound_safety"] is False
    assert c["critical_sound_types"] == {k: False for k in ns.CRITICAL_SOUND_SOURCES}
    assert set(ns.CRITICAL_SOUND_SOURCES) == {"sensor.smoke", "sensor.gas", "sensor.co", "alarm.triggered", "sensor.leak"}


def test_no_flag_by_default_even_for_smoke(w, relay):
    register(w, "ops2")
    _app_only(w, "sensor.smoke")
    _smoke(w)
    w.flush()
    assert len(relay.calls) == 1 and "critical_alert" not in relay.calls[0] and relay.calls[0]["priority"] == "high"


def test_flag_needs_master_and_the_event_type(w, relay):
    register(w, "ops2")
    _app_only(w, "sensor.smoke")
    w.set_settings(companion={"critical_sound_types": {"sensor.smoke": True}})  # type chosen, master still off
    _smoke(w, "a")
    w.flush()
    assert "critical_alert" not in relay.calls[-1]
    w.set_settings(companion={"critical_sound_safety": True, "critical_sound_types": {"sensor.smoke": False}})  # master on, type off
    _smoke(w, "b")
    w.flush()
    assert "critical_alert" not in relay.calls[-1]
    s = w.set_settings(companion={"critical_sound_types": {"sensor.smoke": True}})  # both: a partial update keeps the master
    assert s["companion"]["critical_sound_safety"] is True and s["companion"]["critical_sound_types"]["sensor.smoke"] is True
    _smoke(w, "c")
    w.flush()
    assert relay.calls[-1]["critical_alert"] is True and relay.calls[-1]["priority"] == "high"
    assert set(relay.calls[-1]) == {"url", "relay_token", "category", "notification_id", "priority", "server", "collapse", "critical_alert"}


def test_other_types_and_non_safety_never_carry_the_flag(w, relay):
    register(w, "ops2")
    w.set_settings(companion={"critical_sound_safety": True, "critical_sound_types": {"sensor.smoke": True}})
    ent = w.entity("binary_sensor.kitchen_leak", cls="moisture", floor=w.ids["floor2"], name="חיישן הצפה")
    _app_only(w, "sensor.leak")
    w.emit("sensor.leak", "entity", ent, params={"name": "חיישן הצפה"}, dedupe_key="l1")
    w.set_policy("camera.offline", channels={"webpush": False, "email": False, "app": True}, severity="critical")
    w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"})
    w.flush()
    assert len(relay.calls) == 2 and all("critical_alert" not in c for c in relay.calls)


def test_settings_validation_and_pure_rule(w):
    for body in ({"critical_sound_types": {"camera.offline": True}}, {"critical_sound_types": {"sensor.smoke": "yes"}}, {"critical_sound_types": ["sensor.smoke"]}, {"loud": True}):
        r = w.c.put(f"{API}/notify/settings", json={"companion": body})
        assert r.status_code == 422, (body, r.text)
    s = {"companion": {"critical_sound_safety": True, "critical_sound_types": {"sensor.gas": True}}}
    assert ns.critical_sound_for(s, "sensor.gas", "safety", "critical") is True
    assert ns.critical_sound_for(s, "sensor.gas", "safety", "alert") is False  # downgraded severity
    assert ns.critical_sound_for(s, "sensor.gas", "alerts", "critical") is False
    assert ns.critical_sound_for(s, "sensor.smoke", "safety", "critical") is False
    assert ns.critical_sound_for({}, "sensor.gas", "safety", "critical") is False


# ---------------------------------------------------------------- CRITSERVER217-295: resolved tone + the app's read-only capability view

def _on(w: World, **extra) -> dict:
    return w.set_settings(companion={"critical_sound_safety": True, "critical_sound_types": {"sensor.smoke": True}, **extra})


def _smoke_and_resolve(w: World, key: str) -> None:
    ent = "binary_sensor.kitchen_smoke"
    _smoke(w, key)
    w.flush()
    w.emit("sensor.smoke", "entity", ent, params={"name": "גלאי עשן"}, dedupe_key=key, resolve=True)
    w.flush()


def test_resolved_tone_setting_default_on_validation_and_partial_update(w):
    c = w.c.get(f"{API}/notify/settings").json()["companion"]
    assert c["resolved_tone"] is True  # stored default ON; inert while the master switch and the types are OFF
    for bad in ("yes", 1, None, {"x": 1}):
        r = w.c.put(f"{API}/notify/settings", json={"companion": {"resolved_tone": bad}})
        assert r.status_code == 422, (bad, r.text)
    s = w.set_settings(companion={"resolved_tone": False})
    assert s["companion"]["resolved_tone"] is False and s["companion"]["critical_sound_safety"] is False
    s = w.set_settings(companion={"critical_sound_safety": True})  # a partial update keeps the tone switch
    assert s["companion"]["resolved_tone"] is False


def test_resolved_update_carries_the_tone_only_when_the_capability_and_switch_are_on(w, relay):
    register(w, "ops2")
    _app_only(w, "sensor.smoke")
    w.set_policy("sensor.smoke", resolve_notice=True)
    _smoke_and_resolve(w, "off")  # capability OFF (the default): neither marker on either push
    assert len(relay.calls) == 2 and all("critical_alert" not in c and "resolved_tone" not in c for c in relay.calls)
    _on(w)
    _smoke_and_resolve(w, "on")
    first, resolved = relay.calls[-2], relay.calls[-1]
    assert first["critical_alert"] is True and "resolved_tone" not in first
    assert resolved["resolved_tone"] is True and "critical_alert" not in resolved
    assert set(resolved) == {"url", "relay_token", "category", "notification_id", "priority", "server", "collapse", "resolved_tone"}
    _on(w, resolved_tone=False)  # the owner switched the calming tone off: the resolved push is an ordinary quiet one again
    _smoke_and_resolve(w, "toneoff")
    assert relay.calls[-2]["critical_alert"] is True and "resolved_tone" not in relay.calls[-1] and "critical_alert" not in relay.calls[-1]


def test_resolved_tone_follows_the_same_rule_as_the_critical_flag():
    s = {"companion": {"critical_sound_safety": True, "critical_sound_types": {"sensor.gas": True}, "resolved_tone": True}}
    assert ns.resolved_tone_for(s, "sensor.gas", "safety", "critical") is True
    assert ns.resolved_tone_for(s, "sensor.smoke", "safety", "critical") is False  # type not chosen
    assert ns.resolved_tone_for(s, "sensor.gas", "safety", "alert") is False
    assert ns.resolved_tone_for({"companion": {**s["companion"], "critical_sound_safety": False}}, "sensor.gas", "safety", "critical") is False
    assert ns.resolved_tone_for({"companion": {**s["companion"], "resolved_tone": False}}, "sensor.gas", "safety", "critical") is False
    assert ns.resolved_tone_for({}, "sensor.gas", "safety", "critical") is False


def test_the_app_reads_the_capability_from_the_categories_route(w, relay):
    _did, tok = register(w, "ops2")
    url = f"{API}/notifications/categories"
    assert w.c.get(url, headers=tok).json()["critical_sound"] == {"enabled": False, "types": [], "resolved_tone": False}
    w.set_settings(companion={"critical_sound_safety": True})  # master on but no event type: nothing can ever carry the flag
    assert w.c.get(url, headers=tok).json()["critical_sound"] == {"enabled": False, "types": [], "resolved_tone": False}
    _on(w, critical_sound_types={"sensor.smoke": True, "sensor.leak": True})
    got = w.c.get(url, headers=tok).json()
    assert got["critical_sound"] == {"enabled": True, "types": ["sensor.smoke", "sensor.leak"], "resolved_tone": True}
    assert set(got) == {"categories", "critical_sound"} and got["categories"][0]["id"] == "safety"
    w.set_settings(companion={"resolved_tone": False})
    assert w.c.get(url, headers=tok).json()["critical_sound"]["resolved_tone"] is False
    assert w.c.get(url, headers=as_user("ops2")).json()["critical_sound"]["enabled"] is True  # a session (the web app's device card) reads it too
    w.set_settings(companion={"critical_sound_safety": False})
    assert w.c.get(url, headers=tok).json()["critical_sound"] == {"enabled": False, "types": [], "resolved_tone": False}
