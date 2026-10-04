"""Schedules: the owner's decisions of 2026-10-04 on top of "more actions" (docs/architecture/SCHEDULER_API.md §15).

1. Direct disarming is ALLOWED by default (option ג); a system administrator may restrict it (audited); a stored value is never overwritten.
2. A script that disarms / unlocks / opens a door - or whose content Arx cannot read - is schedulable only while a system administrator's "allowed in
   schedules" mark holds for its current content (option ב): per script, system administrators only, audited with who / when, revoked by itself when
   the script changes; enforced on create / edit / copy / split / restore and at "run now".
3. Sirens (sensitive), media players (the multimedia rules) and number / select values are schedulable actions, each only with what the entity reports.

Fakes only (tests/fake_scheduler.py: the FakeScheduler component and bridge); nothing here reaches a real system, a real alarm or a real siren."""
from __future__ import annotations

import json
from typing import Any

import pytest

import fake_scheduler
from schedules_fixture import *  # noqa: F401,F403
from schedules_fixture import sched_app  # noqa: F401
from schedules_fixture import grant
from smplwise.auth import current_principal, current_principal_ro
from smplwise.rbac import Principal
from smplwise.services import ha_bridge, ha_client, ha_sync
from smplwise.services import schedule_policy as policy
from smplwise.services import schedules as store

API = "/api/v1"
NOW = "2026-09-30T10:00:00Z"

EXTRA: dict[str, tuple[str, str | None, str, dict[str, Any]]] = {
    "script.night_alarm": ("Night alarm script", None, "off", {"last_triggered": None}),
    "script.plain": ("Plain script", "sch_living", "off", {"last_triggered": None}),
    "script.opaque": ("Opaque script", "sch_living", "off", {}),
    # SirenEntityFeature: TURN_ON 1 | TURN_OFF 2 | TONES 4 | VOLUME_SET 8 | DURATION 16
    "siren.yard": ("Yard siren", "sch_living", "off", {"supported_features": 1 | 2 | 4 | 16, "available_tones": {"fire": "Fire", "burglar": "Burglar"}}),
    "siren.basic": ("Basic siren", "sch_living", "off", {"supported_features": 1 | 2}),
    "siren.mute": ("Status siren", "sch_living", "off", {"supported_features": 0}),
    # MediaPlayerEntityFeature: PAUSE 1 | VOLUME_SET 4 | TURN_ON 128 | TURN_OFF 256 | SELECT_SOURCE 2048 | STOP 4096 | PLAY 16384
    "media_player.kitchen": ("Kitchen speaker", "sch_living", "idle", {"supported_features": 1 | 4 | 128 | 256 | 2048 | 4096 | 16384, "source_list": ["Radio", "TV", "Spotify"], "volume_level": 0.2}),
    "media_player.hidden_ep": ("Hidden endpoint", "sch_living", "idle", {"supported_features": 128 | 256}),
    "media_player.stranger": ("Not approved", "sch_living", "idle", {"supported_features": 128 | 256}),
    "media_player.party": ("Party group", "sch_living", "idle", {"supported_features": 4 | 128 | 256}),
    "number.boiler_temp": ("Boiler target", "sch_living", "55", {"min": 40, "max": 70, "step": 5}),
    "number.led_level": ("LED level (config)", "sch_living", "3", {"min": 1, "max": 5, "step": 1}),
    "select.irrigation_program": ("Irrigation program", "sch_living", "short", {"options": ["short", "long", "off"]}),
}
CATEGORY = {"number.led_level": "config"}
SCRIPT_CONFIGS = {
    "script.night_alarm": {"alias": "Night alarm script", "sequence": [{"action": "alarm_control_panel.alarm_disarm", "target": {"entity_id": "alarm_control_panel.shed_panel"}}]},
    "script.plain": {"alias": "Plain script", "sequence": [{"action": "light.turn_on", "target": {"entity_id": "light.office"}}]},
}


def _media(conn, key: str, ref: str, *, kind: str = "speaker", approved: int = 1, hidden: int = 0, public: int = 0, volume_max: int | None = None,
           night: dict[str, Any] | None = None, sources: list[dict[str, Any]] | None = None) -> None:
    conn.execute("INSERT INTO media_devices(device_key, kind, kind_source, display_name, anchor_entity_id, approved, is_public, volume_max, volume_night_json, sources_json, created_at, updated_at) "
                 "VALUES (?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?, ?)", (key, kind, key, ref, approved, public, volume_max, json.dumps(night) if night else None,
                                                                        json.dumps(sources) if sources else None, NOW, NOW))
    conn.execute("INSERT INTO media_device_endpoints(endpoint_id, source, ref, device_key, role, platform, rule, link_source, hidden, updated_at) "
                 "VALUES (?, 'ha', ?, ?, 'vendor', 'generic', 'manual', 'manual', ?, ?)", (f"ha:{ref}", ref, key, hidden, NOW))


def _extra(app, fake) -> None:
    states, reg = [], []
    for eid, (name, area, st, attrs) in EXTRA.items():
        state = {"entity_id": eid, "state": st, "attributes": {"friendly_name": name, **attrs}, "last_changed": "2026-09-30T10:00:00+00:00", "last_updated": "2026-09-30T10:00:00+00:00"}
        states.append(state)
        fake.world[eid] = state
        reg.append({"id": f"reg-{eid}", "entity_id": eid, "unique_id": f"u-{eid}", "platform": "generic", "config_entry_id": "ce-generic", "device_id": None, "area_id": area,
                    "entity_category": CATEGORY.get(eid), "original_name": name, "name": None, "disabled_by": None, "hidden_by": None})
    with app.state.db.connection() as conn:
        for st in states:
            ha_sync.upsert_state(conn, st)
        ha_sync.apply_registry(conn, ha_client.registry_maps(reg, [], fake_scheduler.AREAS, fake_scheduler.FLOORS))
        for eid, cfg in SCRIPT_CONFIGS.items():
            conn.execute("INSERT INTO ha_config_items(kind, item_id, config_id, entity_id, source, revision, config_json, masked, reason, seen_at, changed_at) VALUES ('script', ?, ?, ?, 'ui', 'r1', ?, 0, NULL, ?, ?)",
                         (eid.split(".", 1)[1], eid.split(".", 1)[1], eid, json.dumps(cfg), NOW, NOW))
        _media(conn, "mk", "media_player.kitchen", volume_max=60, night={"from": "22:00", "to": "07:00", "max": 40}, sources=[{"id": "TV", "label": "TV", "hidden": True}])
        _media(conn, "mh", "media_player.hidden_ep", hidden=1)
        _media(conn, "ms", "media_player.stranger", approved=0)
        _media(conn, "mp", "media_player.party", kind="group")


@pytest.fixture()
def follow(sched_app):
    app, s, c, fake, tr = sched_app
    _extra(app, fake)
    assert c.post(f"{API}/ha/bridge/ping", json=ha_bridge.sign(tr.secret, {"version": "0.6.1"})).status_code == 200
    return app, s, c, fake, tr


def _catalog(c, headers: dict[str, str] | None = None, **q) -> dict[str, dict[str, Any]]:
    r = c.get(f"{API}/schedules/catalog", params=q, headers=headers or {})
    assert r.status_code == 200, r.text
    return {e["entity_id"]: e for e in r.json()["entities"]}


def _create(c, d: dict[str, Any], headers: dict[str, str] | None = None, **extra: Any):
    return c.post(f"{API}/schedules", json={"draft": d, "enabled": True, "client_request_id": rid(), **extra}, headers=headers or {})


def _one(service: str, entity: str, name: str = "One", **data: Any) -> dict[str, Any]:
    return draft_of(name, [slot("06:15:00", None, act(service, entity, **data))])


def _audit(app, action: str) -> list[dict[str, Any]]:
    with app.state.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]


def _mark(c, eid: str, undo: bool = False, headers: dict[str, str] | None = None):
    return c.post(f"{API}/schedules/scripts/{eid}/mark", json={"undo": undo}, headers=headers or {})


def _change_script(app, eid: str, cfg: dict[str, Any]) -> None:
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_config_items SET config_json = ?, revision = 'r2' WHERE entity_id = ?", (json.dumps(cfg), eid))


# ================================================================ decision 1: disarming allowed by default, restrictable

def test_disarm_default_is_allowed_and_a_stored_restriction_is_kept(follow):
    app, s, c, fake, tr = follow
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT 1 FROM settings WHERE key = 'schedules.allow_disarm'").fetchone() is None, "nothing stored: the default applies"
    assert c.get(f"{API}/schedules/status").json()["settings"]["allow_disarm"] is True
    # a value stored before (the branch's earlier default was "blocked") is read as stored - never rewritten by the new default
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES ('schedules.allow_disarm', 'false')")
    assert c.get(f"{API}/settings").json()["settings"]["schedules.allow_disarm"] == "false"
    assert c.get(f"{API}/schedules/status").json()["settings"]["allow_disarm"] is False
    r = _create(c, _one("alarm_control_panel.alarm_disarm", "alarm_control_panel.shed_panel"), confirm_lowering=True)
    assert r.status_code == 422 and r.json()["code"] == "disarm_not_allowed"
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT value FROM settings WHERE key = 'schedules.allow_disarm'").fetchone()[0] == "false"


def test_allowed_disarm_still_needs_the_grant_the_sensitive_permission_and_the_confirmation(follow):
    app, s, c, fake, tr = follow
    d = _one("alarm_control_panel.alarm_disarm", "alarm_control_panel.shed_panel", name="Disarm")
    assert _create(c, d).json()["code"] == "lowering_confirmation_required"
    grant(c, "arm", "Arm only", ["schedule.view", "devices.read", "entity.state.read", "alarm.view", "alarm.arm"], ["schedule.manage", "schedule.sensitive", "ha.entity.control"], "installation", "*")
    r = _create(c, d, headers={"X-SW-Dev-User": "arm"}, confirm_lowering=True)
    assert r.status_code == 403 and r.json()["code"] == "grant_required", "the disarm permission on that panel"
    grant(c, "plain", "No sensitive", ["schedule.view", "devices.read", "entity.state.read", "alarm.view"], ["schedule.manage", "ha.entity.control", "alarm.disarm"], "installation", "*")
    r = _create(c, d, headers={"X-SW-Dev-User": "plain"}, confirm_lowering=True)
    assert r.status_code == 403 and r.json()["code"] == "sensitive_permission_required"
    r = _create(c, _one("alarm_control_panel.alarm_disarm", "alarm_control_panel.home_panel"), confirm_lowering=True)
    assert r.status_code == 422 and r.json()["code"] == "alarm_code_needed", "a disarm that needs a code stays unschedulable"


# ================================================================ decision 2: the per-script "allowed in schedules" mark

def test_a_disarming_script_needs_the_mark_which_is_audited_and_bound_to_the_content(follow):
    app, s, c, fake, tr = follow
    d = _one("script.turn_on", "script.night_alarm", name="Night")
    listing = {x["entity_id"]: x for x in c.get(f"{API}/schedules/scripts").json()["scripts"]}
    assert listing["script.night_alarm"]["approval"] == {"required": True, "approved": False, "stale": False, "by": None, "at": None} and listing["script.night_alarm"]["lowering"] is True
    assert listing["script.plain"]["approval"]["required"] is False and listing["script.opaque"]["approval"]["required"] is True
    assert c.get(f"{API}/schedules/scripts").json()["can_mark"] is True
    r = _create(c, d, confirm_lowering=True)
    assert r.status_code == 422 and r.json()["code"] == "script_not_approved" and not any(b["op"] == "add" for b in tr.fake.bridge_calls)
    # the mark: who and when, on its own audit row
    r = _mark(c, "script.night_alarm")
    assert r.status_code == 200 and r.json()["approval"]["approved"] is True and r.json()["approval"]["by"]["username"] == "joni" and r.json()["approval"]["at"]
    row = _audit(app, "schedule.script_mark")[-1]
    assert row["decision"] == "allowed" and row["actor_username"] == "joni" and json.loads(row["details_json"])["script"] == "script.night_alarm"
    assert _catalog(c)["script.night_alarm"]["selectable"] is True
    r = _create(c, d, confirm_lowering=True)
    assert r.status_code == 201, r.text
    sid = r.json()["schedule"]["id"]
    assert r.json()["schedule"]["can"]["run"] is True
    # the script changes: the mark lapses by itself - the catalogue, the schedule ("run now" refused) and the listing say so
    _change_script(app, "script.night_alarm", {**SCRIPT_CONFIGS["script.night_alarm"], "sequence": SCRIPT_CONFIGS["script.night_alarm"]["sequence"] * 2})
    assert _catalog(c)["script.night_alarm"]["reason"]["code"] == "script_not_approved"
    got = c.get(f"{API}/schedules/{sid}").json()
    assert got["can"]["run"] is False and any(w["code"] == "script_not_approved" for w in got["warnings"]) and got["slots"][0]["actions"][0]["blocked"]["code"] == "script_not_approved"
    run = c.post(f"{API}/schedules/{sid}/run", json={"client_request_id": rid(), "confirm": True})
    assert run.status_code == 409 and run.json()["code"] == "script_not_approved" and _audit(app, "schedule.run")[-1]["decision"] == "denied"
    item = {x["entity_id"]: x for x in c.get(f"{API}/schedules/scripts").json()["scripts"]}["script.night_alarm"]
    assert item["approval"]["approved"] is False and item["approval"]["stale"] is True and item["approval"]["by"]["username"] == "joni"
    # an existing, unchanged action is kept (a warning), a copy is a new action and is refused
    put = put_draft(c, sid, {**_one("script.turn_on", "script.night_alarm", name="Night renamed")}, got["revision"], confirm_lowering=True)
    assert put.status_code == 200, put.text
    assert any(w["code"] == "script_not_approved" for w in put.json()["schedule"]["warnings"])
    cp = post_json(c, f"/schedules/{sid}/copy", {"name": "Copy", "client_request_id": rid(), "confirm_lowering": True})
    assert cp.status_code == 422 and cp.json()["code"] == "script_not_approved"
    # marked again (for the new content): everything works again; removing the mark is audited too
    assert _mark(c, "script.night_alarm").status_code == 200
    assert c.get(f"{API}/schedules/{sid}").json()["can"]["run"] is True
    assert _mark(c, "script.night_alarm", undo=True).status_code == 200 and _audit(app, "schedule.script_unmark")[-1]["decision"] == "allowed"
    assert _mark(c, "script.night_alarm", undo=True).status_code == 409


def test_split_and_restore_of_an_unmarked_disarming_script_are_refused(follow):
    app, s, c, fake, tr = follow
    assert _mark(c, "script.night_alarm").status_code == 200
    d = draft_of("Split me", [slot("06:15:00", None, act("script.turn_on", "script.night_alarm"))])
    d["weekdays"] = ["sun", "mon", "tue"]
    sid = _create(c, d, confirm_lowering=True).json()["schedule"]["id"]
    assert _mark(c, "script.night_alarm", undo=True).status_code == 200
    cur = c.get(f"{API}/schedules/{sid}").json()
    r = post_json(c, f"/schedules/{sid}/split", {"base_revision": cur["revision"], "days": ["tue"], "name": None, "confirm": True, "client_request_id": rid(), "confirm_lowering": True})
    assert r.status_code == 422 and r.json()["code"] == "script_not_approved"
    # delete is always possible; the restore is a new schedule and is refused while the mark is missing
    assert post_json(c, f"/schedules/{sid}/delete", {"base_revision": cur["revision"], "confirm": True, "client_request_id": rid()}).status_code == 200
    trash = c.get(f"{API}/schedules/trash").json()["items"]
    tid = next(t["trash_id"] for t in trash if t["schedule_id"] == sid)
    r = post_json(c, f"/schedules/trash/{tid}/restore", {"client_request_id": rid(), "confirm_lowering": True})
    assert r.status_code == 422 and r.json()["code"] == "script_not_approved"


def test_only_a_system_administrator_marks_and_an_ordinary_script_needs_none(follow):
    app, s, c, fake, tr = follow
    grant(c, "sam", "Site manager", ["schedule.view", "devices.read", "entity.state.read", "script.run", "alarm.view"],
          ["schedule.manage", "schedule.sensitive", "ha.entity.control", "alarm.disarm"], "installation", "*")
    r = _mark(c, "script.night_alarm", headers={"X-SW-Dev-User": "sam"})
    assert r.status_code == 403
    row = _audit(app, "schedule.script_mark")[-1]
    assert row["decision"] == "denied" and row["actor_username"] == "sam"
    assert c.get(f"{API}/schedules/scripts", headers={"X-SW-Dev-User": "sam"}).json()["can_mark"] is False
    assert _mark(c, "script.plain").status_code == 409, "an ordinary script is schedulable without a mark"
    assert _mark(c, "script.nothing_here").status_code == 404 and _mark(c, "light.office").status_code == 404
    assert _create(c, _one("script.turn_on", "script.plain")).status_code == 201
    # a manager without the right to read anything never sees the list
    grant(c, "viewer", "Viewer", ["schedule.view"], [], "installation", "*")
    assert c.get(f"{API}/schedules/scripts", headers={"X-SW-Dev-User": "viewer"}).status_code == 403


# ================================================================ decision 3: sirens, media players, number / select

def test_the_allow_list_now_holds_the_new_classes_and_needs_the_newer_bridge(follow):
    app, s, c, fake, tr = follow
    for svc in ("siren.turn_on", "media_player.volume_set", "number.set_value", "select.select_option"):
        assert svc in policy.NEWER_BRIDGE_SERVICES
    assert policy.SENSITIVE_CLASSES >= {"siren"} and "media" not in policy.SENSITIVE_CLASSES
    assert c.post(f"{API}/ha/bridge/ping", json=ha_bridge.sign(tr.secret, {"version": "0.6.0"})).status_code == 200
    r = _create(c, _one("siren.turn_off", "siren.yard"))
    assert r.status_code == 503 and r.json()["code"] == "bridge_too_old_for_action"


def test_a_siren_is_sensitive_and_takes_only_what_it_reports(follow):
    app, s, c, fake, tr = follow
    cat = _catalog(c)
    yard = {a["service"]: a for a in cat["siren.yard"]["actions"]}
    assert cat["siren.yard"]["class"] == "siren" and cat["siren.yard"]["sensitive"] is True
    args = {a["name"]: a for a in yard["siren.turn_on"]["args"]}
    assert args["tone"]["choices"] == ["fire", "burglar"] and args["duration"]["max"] == 3600 and "volume_level" not in args, "no VOLUME_SET bit: no volume"
    assert [a["args"] for a in cat["siren.basic"]["actions"] if a["service"] == "siren.turn_on"] == [[]], "no tone / duration bits: no arguments"
    assert cat["siren.mute"]["selectable"] is False, "a siren that reports neither on nor off is listed with the reason"
    r = _create(c, _one("siren.turn_on", "siren.yard", tone="fire", duration=60))
    assert r.status_code == 201, r.text
    assert r.json()["schedule"]["sensitive"] is True and next(b for b in tr.fake.bridge_calls if b["op"] == "add")["sensitive"] is True
    assert _create(c, _one("siren.turn_on", "siren.yard", tone="party")).status_code == 422
    assert _create(c, _one("siren.turn_on", "siren.yard", volume_level=0.5)).status_code == 422
    assert _create(c, _one("siren.turn_on", "siren.basic", duration=30)).status_code == 422
    r = _create(c, _one("siren.turn_on", "siren.mute"))
    assert r.status_code == 422 and r.json()["code"] == "service_not_supported"
    # the sensitive permission and control of the siren itself (devices.control is not enough)
    grant(c, "nos", "No sensitive", ["schedule.view", "devices.read", "entity.state.read"], ["schedule.manage", "ha.entity.control"], "installation", "*")
    r = _create(c, _one("siren.turn_off", "siren.yard"), headers={"X-SW-Dev-User": "nos"})
    assert r.status_code == 403 and r.json()["code"] == "sensitive_permission_required"
    grant(c, "dc", "Devices control only", ["schedule.view", "devices.read", "entity.state.read", "devices.control"], ["schedule.manage", "schedule.sensitive"], "installation", "*")
    r = _create(c, _one("siren.turn_off", "siren.yard"), headers={"X-SW-Dev-User": "dc"})
    assert r.status_code == 403 and r.json()["code"] == "entity_not_controllable"


def _remote_joni() -> Principal:
    return Principal(user_id="dev-joni", username="joni", display_name="joni", source="remote", via="cookie")


def test_the_remote_channel_refuses_a_siren_and_a_disarm_like_the_alarm_screen(follow):
    app, s, c, fake, tr = follow
    bind(c, s, "boss", "system_admin", "installation", "*")
    assert c.put(f"{API}/alarm/users/dev-joni/policy", json={"arm_policy": "no_code", "disarm_policy": "no_code", "current_pin": None}, headers=BOSS).status_code == 200
    assert c.patch(f"{API}/settings", json={"alarm.remote_control": "false"}).status_code == 200
    app.dependency_overrides[current_principal] = app.dependency_overrides[current_principal_ro] = _remote_joni
    try:
        r = _create(c, _one("siren.turn_off", "siren.yard"))
        assert r.status_code == 403 and r.json()["code"] == "remote_control_disabled"
        r = _create(c, _one("alarm_control_panel.alarm_disarm", "alarm_control_panel.shed_panel"), confirm_lowering=True)
        assert r.status_code == 403 and r.json()["code"] == "remote_control_disabled"
        assert _create(c, _one("number.set_value", "number.boiler_temp", value=50)).status_code == 201, "everything else is the same on the remote channel"
        app.dependency_overrides.pop(current_principal); app.dependency_overrides.pop(current_principal_ro)
        assert c.patch(f"{API}/settings", json={"alarm.remote_control": "true", "alarm.remote_disarm": "false"}).status_code == 200
        app.dependency_overrides[current_principal] = app.dependency_overrides[current_principal_ro] = _remote_joni
        assert _create(c, _one("siren.turn_off", "siren.yard", name="Remote siren")).status_code == 201
        r = _create(c, _one("alarm_control_panel.alarm_disarm", "alarm_control_panel.shed_panel", name="Remote disarm"), confirm_lowering=True)
        assert r.status_code == 403 and r.json()["code"] == "remote_disarm_disabled"
    finally:
        app.dependency_overrides.pop(current_principal, None); app.dependency_overrides.pop(current_principal_ro, None)


def test_media_players_follow_the_multimedia_rules(follow):
    app, s, c, fake, tr = follow
    cat = _catalog(c)
    assert "media_player.hidden_ep" not in cat and "media_player.stranger" not in cat and "media_player.party" not in cat, "only an approved, visible room player"
    kitchen = {a["service"]: a for a in cat["media_player.kitchen"]["actions"]}
    assert set(kitchen) == {"media_player.turn_on", "media_player.turn_off", "media_player.media_play", "media_player.media_pause", "media_player.media_stop",
                            "media_player.volume_set", "media_player.select_source"}
    assert kitchen["media_player.select_source"]["args"][0]["choices"] == ["Radio", "Spotify"], "a source the administrator hid is never offered"
    assert kitchen["media_player.volume_set"]["args"][0]["max"] == pytest.approx(0.4), "the lower of the ceiling and the night window's max"
    assert _create(c, _one("media_player.volume_set", "media_player.kitchen", volume_level=0.3)).status_code == 201
    r = _create(c, _one("media_player.volume_set", "media_player.kitchen", volume_level=0.5))
    assert r.status_code == 422 and "out_of_range" in {e["code"] for e in r.json()["details"]["errors"]}
    assert _create(c, _one("media_player.select_source", "media_player.kitchen", source="TV")).status_code == 422
    assert _create(c, _one("media_player.select_source", "media_player.kitchen", source="Radio")).status_code == 201
    for eid, code in (("media_player.hidden_ep", "media_not_approved"), ("media_player.stranger", "media_not_approved"), ("media_player.party", "media_not_approved")):
        r = _create(c, _one("media_player.turn_on", eid))
        assert r.status_code == 422 and r.json()["code"] == code, eid
    # the multimedia permissions at the device: power needs media.power, the rest media.control
    grant(c, "ctl", "Media control", ["schedule.view", "devices.read", "entity.state.read", "media.read", "media.control"], ["schedule.manage", "ha.entity.control"], "installation", "*")
    r = _create(c, _one("media_player.turn_off", "media_player.kitchen"), headers={"X-SW-Dev-User": "ctl"})
    assert r.status_code == 403 and r.json()["code"] == "grant_required"
    assert _create(c, _one("media_player.media_pause", "media_player.kitchen", name="Pause"), headers={"X-SW-Dev-User": "ctl"}).status_code == 201
    # the multimedia area switched off: no media action
    assert c.patch(f"{API}/settings", json={"multimedia.enabled": "false"}).status_code == 200
    r = _create(c, _one("media_player.media_pause", "media_player.kitchen"))
    assert r.status_code == 422 and r.json()["code"] == "media_disabled"


def test_a_player_that_lost_its_approval_makes_the_action_invalid_not_hidden(follow):
    app, s, c, fake, tr = follow
    sid = _create(c, _one("media_player.media_play", "media_player.kitchen", name="Morning music")).json()["schedule"]["id"]
    with app.state.db.connection() as conn:
        conn.execute("UPDATE media_devices SET approved = 0 WHERE device_key = 'mk'")
    got = c.get(f"{API}/schedules/{sid}").json()
    assert got["read_only"] is None and got["can"]["run"] is False and got["slots"][0]["actions"][0]["invalid"]["code"] == "media_not_approved"
    assert c.post(f"{API}/schedules/{sid}/run", json={"client_request_id": rid(), "confirm": True}).json()["code"] == "action_invalid"


def test_number_and_select_values_come_from_the_entity(follow):
    app, s, c, fake, tr = follow
    cat = _catalog(c)
    assert "number.led_level" not in cat, "a configuration value is never offered"
    arg = cat["number.boiler_temp"]["actions"][0]["args"][0]
    assert (arg["min"], arg["max"], arg["step"]) == (40.0, 70.0, 5.0)
    assert cat["select.irrigation_program"]["actions"][0]["args"][0]["choices"] == ["short", "long", "off"]
    assert _create(c, _one("number.set_value", "number.boiler_temp", value=60)).status_code == 201
    for bad in (75, 39, 52):
        r = _create(c, _one("number.set_value", "number.boiler_temp", value=bad))
        assert r.status_code == 422 and "out_of_range" in {e["code"] for e in r.json()["details"]["errors"]}, bad
    assert _create(c, _one("select.select_option", "select.irrigation_program", option="long")).status_code == 201
    assert _create(c, _one("select.select_option", "select.irrigation_program", option="flood")).status_code == 422
    r = _create(c, _one("number.set_value", "number.led_level", value=2))
    assert r.status_code == 422 and r.json()["code"] == "action_not_allowed"
    sent = [b for b in tr.fake.bridge_calls if b["op"] == "add"]
    assert {"service": "number.set_value", "entity_id": "number.boiler_temp", "service_data": {"value": 60}} in [a for b in sent for sl in b["payload"]["timeslots"] for a in sl["actions"]]


def test_the_classes_setting_switches_the_new_classes_off(follow):
    app, s, c, fake, tr = follow
    assert c.patch(f"{API}/settings", json={"schedules.classes": [x for x in policy.ALL_CLASSES if x not in ("siren", "media")]}).status_code == 200
    r = _create(c, _one("siren.turn_off", "siren.yard"))
    assert r.status_code == 422 and r.json()["code"] == "class_not_allowed"
    cat = _catalog(c)
    assert "siren.yard" not in cat and "media_player.kitchen" not in cat and "number.boiler_temp" in cat
    store.MIRROR.pull(None, "test")
