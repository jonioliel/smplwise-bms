"""CR-017 preview (docs/architecture/AUTOMATIONS_API.md §3.1 row 6, §3.2): always 200 for a well-formed body, problems are data, nothing is written; the live Hebrew sentence per block, the
affected devices, the sensitive steps with the grant each needs, what the save would require (confirm / code view / HA admin), HA's own validation, warnings (missing device, self trigger,
unknown effects) and the CR-014 schedule suggestion - a suggestion, never a refusal."""
from __future__ import annotations

import copy

from automations_fixture import *  # noqa: F401,F403
from automations_fixture import autos_app  # noqa: F401
from automations_fixture import API, OMER, SHABBAT, create_item, draft_of, get_item, item_by_name, rid, svc_block, typed_state_trigger


def pv(c, body, headers=None):
    r = c.post(f"{API}/automations/preview", json=body, headers=headers or {})
    assert r.status_code == 200, r.text
    return r.json()


def _scheduler_present(app):
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO ha_entities(entity_id, domain, platform, state, state_seen_at, first_seen_at, updated_at) VALUES ('switch.schedule_abc', 'switch', 'scheduler', 'on', 't', 't', 't')")


def test_a_valid_draft_previews_with_sentences_effects_and_requirements(autos_app):
    app, s, c, fake, tr = autos_app
    out = pv(c, {"kind": "automation", "draft": draft_of("בדיקה", conditions=[{"uid": "c1", "kind": "typed", "type": "shabbat", "mode": "not_holy_days"}])})
    assert out["valid"] is True and out["errors"] == [] and out["ha_validation"] == "ok"
    assert out["sentence"].startswith("כש־Hall motion הופך לדלוק, אם לא בשבת ובחג, אז הדלקת Office light") and out["block_sentences"]["trigger/0"] and out["block_sentences"]["condition/0"] == "לא בשבת ובחג"
    assert out["effects"] == {"entities": [{"entity_id": "light.office", "name": "Office light", "floor": "Ground floor", "area": "Living room", "from": "off", "to": "on"}], "unknown": False}
    assert out["sensitive"] is False and out["sensitive_steps"] == [] and out["requires"] == {"confirm": False, "code_view": False, "ha_admin": False} and out["suggest_schedule"] is None
    assert not fake.bridge_calls and len(fake.files["automation"]) == 16, "a preview never writes"


def test_problems_are_data_not_errors(autos_app):
    app, s, c, fake, tr = autos_app
    out = pv(c, {"kind": "automation", "draft": draft_of("x", triggers=[])})
    assert out["valid"] is False and out["errors"][0]["path"] == "triggers" and out["sentence"] == ""
    out = pv(c, {"kind": "automation", "draft": draft_of("x", actions=[svc_block("homeassistant.turn_on", ["light.office"])])})
    assert out["valid"] is False and out["errors"][0]["code"] == "action_not_allowed" and out["errors"][0]["path"] == "action/0"
    r = c.post(f"{API}/automations/preview", json={"kind": "automation"})
    assert r.status_code == 422
    r = c.post(f"{API}/automations/preview", json={"kind": "automation", "draft": draft_of("x"), "config": {}})
    assert r.status_code == 422
    r = c.post(f"{API}/automations/preview", json={"kind": "widget", "draft": {}})
    assert r.status_code == 422
    assert c.post(f"{API}/automations/preview", json={"kind": "automation", "id": "nope", "draft": draft_of("x")}).status_code == 404


def test_warnings_unknown_effects_self_trigger_and_missing_devices(autos_app):
    app, s, c, fake, tr = autos_app
    out = pv(c, {"kind": "automation", "draft": draft_of("x", actions=[svc_block("fan.turn_on", ["fan.nowhere"])])})
    assert [w["code"] for w in out["warnings"]] == ["missing_entity"] and out["valid"] is True
    out = pv(c, {"kind": "automation", "draft": draft_of("x", triggers=[typed_state_trigger("light.office")], actions=[svc_block("light.turn_off", ["light.office"])])})
    assert out["requires"]["confirm"] is True and any(w["code"] == "self_trigger" for w in out["warnings"])
    tpl = get_item(c, "automation", item_by_name(c, "תבניות – התראת טמפרטורה")["id"]).json()
    out = pv(c, {"kind": "automation", "id": tpl["id"], "draft": tpl["draft"]})
    assert out["valid"] is True and out["requires"]["confirm"] is True and out["effects"]["unknown"] is True and any(w["code"] == "unknown_effects" for w in out["warnings"])
    assert any("is_state" not in str(v) for v in out["block_sentences"].values()) and "{{" not in str(out["block_sentences"])
    out = pv(c, {"kind": "automation", "id": tpl["id"], "draft": {**tpl["draft"], "triggers": [{"uid": "x", "kind": "locked", "fingerprint": "ffffffffffffffff"}]}})
    assert out["valid"] is False and out["errors"][0]["code"] == "locked_block_changed"


def test_the_code_view_preview_reports_the_profile_and_home_assistants_verdict(autos_app):
    app, s, c, fake, tr = autos_app
    d = get_item(c, "automation", item_by_name(c, "מזגן סלון בבוקר")["id"]).json()
    cfg = copy.deepcopy(d["config"])
    cfg["conditions"].append({"condition": "template", "value_template": "{{ true }}"})
    out = pv(c, {"kind": "automation", "id": d["id"], "config": cfg})
    assert out["valid"] is True and out["requires"] == {"confirm": False, "code_view": True, "ha_admin": True}
    cfg["triggers"].append({"trigger": "bogus_platform"})
    out = pv(c, {"kind": "automation", "id": d["id"], "config": cfg})
    assert out["ha_validation"] == "failed" and out["valid"] is False and out["errors"][-1]["code"] == "ha_validation"
    cfg2 = copy.deepcopy(d["config"])
    cfg2["actions"][0]["data"]["secret"] = "x"
    out = pv(c, {"kind": "automation", "id": d["id"], "config": cfg2})
    assert out["valid"] is False and out["errors"][0]["code"] == "masked_values"
    tr.up = False
    assert pv(c, {"kind": "automation", "draft": draft_of("x")})["ha_validation"] == "skipped"


def test_a_scoped_caller_previews_only_what_they_may_see(autos_app):
    app, s, c, fake, tr = autos_app
    ids = seed_tree(c)
    place(c, ids["floor2"], "light.office")
    grant(c, "omer", "צופה צר", ["automation.view", "devices.read", "entity.state.read"], [], "floor", ids["floor2"])
    out = pv(c, {"kind": "automation", "draft": draft_of("x", actions=[svc_block("climate.turn_off", ["climate.bedroom_1"])])}, OMER)
    assert out["effects"]["entities"][0] == {"entity_id": "climate.bedroom_1", "name": "climate.bedroom_1", "floor": None, "area": None, "from": None, "to": "off"}
    assert "Bedroom 1 AC" not in str(out), "a device outside the caller's reach is not named"
    assert c.post(f"{API}/automations/preview", json={"kind": "automation", "draft": draft_of("x")}, headers={"X-SW-Dev-User": "stranger"}).status_code == 403


def test_the_schedule_suggestion_is_a_warning_with_a_draft_and_never_a_refusal(autos_app):
    app, s, c, fake, tr = autos_app
    time_draft = draft_of("מזגן בשעה", triggers=[{"uid": "t", "kind": "typed", "type": "time", "at": "07:00:00", "id": None}, {"uid": "t2", "kind": "typed", "type": "sun", "event": "sunset", "offset_min": -30, "id": None}],
                          conditions=[{"uid": "c1", "kind": "typed", "type": "time", "after": None, "before": None, "weekday": ["sun", "mon"]}, {"uid": "c2", "kind": "typed", "type": "shabbat", "mode": "not_holy_days"}],
                          actions=[svc_block("climate.set_temperature", ["climate.living_room"], {"temperature": 24, "hvac_mode": "cool"}), svc_block("light.turn_on", ["light.office"], uid="n3")])
    assert pv(c, {"kind": "automation", "draft": time_draft})["suggest_schedule"] is None, "no scheduler component, no suggestion"
    _scheduler_present(app)
    out = pv(c, {"kind": "automation", "draft": time_draft})
    assert out["valid"] is True and any(w["code"] == "suggest_schedule" for w in out["warnings"])
    sched = out["suggest_schedule"]["schedule_draft"]
    assert sched["name"] == "מזגן בשעה" and sched["weekdays"] == ["sun", "mon"] and [x["start"] for x in sched["slots"]] == ["07:00:00", "sunset-00:30:00"]
    assert sched["conditions"] == {"items": [{"entity_id": SHABBAT, "attribute": "state", "match_type": "is", "value": "off"}], "type": "and", "track": False}
    assert sched["slots"][0]["actions"] == [{"service": "climate.set_temperature", "entity_id": "climate.living_room", "data": {"temperature": 24, "hvac_mode": "cool"}}, {"service": "light.turn_on", "entity_id": "light.office", "data": {}}]
    # the save is not refused for it
    r = create_item(c, "automation", time_draft)
    assert r.status_code == 201 and any(w["code"] == "suggest_schedule" for w in r.json()["item"]["warnings"]) and r.json()["item"]["can"]["edit"] is True
    # not suggested: a state trigger, a sensitive action, a choose
    assert pv(c, {"kind": "automation", "draft": draft_of("x")})["suggest_schedule"] is None
    sens = copy.deepcopy(time_draft)
    sens["actions"] = [svc_block("lock.unlock", ["lock.front_door"])]
    assert pv(c, {"kind": "automation", "draft": sens})["suggest_schedule"] is None
    # the templates "time only" flag
    t = {x["id"]: x for x in c.get(f"{API}/automations/templates").json()["templates"]}
    assert t["lights_at_sunset"]["suggest_schedule"] is True and t["motion_light"]["suggest_schedule"] is False
    d = get_item(c, "automation", r.json()["item"]["id"]).json()
    assert d["suggest_schedule"]["slots"][0]["start"] == "07:00:00"


def test_the_preview_rate_limit_is_a_setting(autos_app):
    app, s, c, fake, tr = autos_app
    assert c.patch(f"{API}/settings", json={"automations.limits": {"preview_per_min": 2}}).status_code == 200
    codes = [c.post(f"{API}/automations/preview", json={"kind": "automation", "draft": draft_of("x")}).status_code for _ in range(3)]
    assert codes == [200, 200, 429]
