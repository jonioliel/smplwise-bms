"""CR-017 writes by an HA administrator (docs/architecture/AUTOMATIONS_API.md §3.2, §4): create, replace, the code view, copy, delete -> trash -> restore, versions,
enable / disable, run, scripts and scenes - each through the real bridge code against the fake Home Assistant - plus idempotency, conflicts, the locked-block
rule, validation errors, and every refusal on the way (bridge too old, HA down, timeout, include line missing, Home Assistant's own validator)."""
from __future__ import annotations

import copy
import json
from pathlib import Path

from automations_fixture import *  # noqa: F401,F403
from automations_fixture import autos_app  # noqa: F401
from automations_fixture import API, NOTIFY, create_item, draft_of, get_item, item_by_name, put_item, rid, svc_block, typed_state_trigger
import datetime as dt

from smplwise.db import set_setting
from smplwise.services import automations
from smplwise.services import automation_model as model


def _file_item(fake, item_id):
    return next(i for i in fake.automations if str(i.get("id")) == item_id)


def _detail(c, name, kind="automation"):
    it = item_by_name(c, name, kind)
    return get_item(c, kind, it["id"]).json()


def _editable_draft(d):
    return copy.deepcopy(d["draft"])


# ================================================================ create

def test_create_writes_the_new_schema_reloads_only_that_item_and_keeps_a_backup(autos_app):
    app, s, c, fake, tr = autos_app
    r = create_item(c, "automation", draft_of("תאורת בדיקה", conditions=[{"uid": "c9", "kind": "typed", "type": "time", "after": "18:00:00", "before": None, "weekday": ["sun", "mon"], "raw": None, "sentence": ""}]))
    assert r.status_code == 201, r.text
    item = r.json()["item"]
    assert item["name"] == "תאורת בדיקה" and item["created_via"] == "arx" and item["can"]["edit"] is True and item["revision"] and item["entity_id"].startswith("automation.")
    stored = _file_item(fake, item["config_id"])
    assert list(stored)[:4] == ["id", "alias", "description", "triggers"] and "trigger" not in stored and "platform" not in json.dumps(stored)
    assert stored["triggers"] == [{"trigger": "state", "entity_id": ["binary_sensor.motion_hall"], "to": "on"}]
    assert stored["actions"] == [{"action": "light.turn_on", "target": {"entity_id": ["light.office"]}, "data": {"brightness_pct": 40}}]
    assert stored["conditions"] == [{"condition": "time", "after": "18:00:00", "weekday": ["sun", "mon"]}] and stored["mode"] == "single"
    assert [(x["domain"], x["service"]) for x in fake.calls if x["service"] == "reload"] == [("automation", "reload")] and fake.calls[-1]["data"] == {"id": item["config_id"]}
    assert any((Path(fake.bridge_hass().config.config_dir) / "smplwise_bridge_backups").glob("automations.yaml.*.bak")), "the previous file is kept in the bridge's backup ring"
    call = tr.bridge_calls[-1]
    assert call["op"] == "upsert" and call["profile"] == "builder" and call["base_revision"] is None and call["user_id"] == "dev-joni"
    d = get_item(c, "automation", item["id"]).json()
    assert d["versions"] == 1 and c.get(f"{API}/automations/automation/{item['id']}/versions").json()["items"][0]["via"] == "arx"
    with app.state.db.connection() as conn:
        a = conn.execute("SELECT action, decision, details_json FROM audit_log WHERE action = 'automation.create'").fetchone()
        assert a["decision"] == "allowed" and json.loads(a["details_json"])["delegated"] is False and "light.office" in a["details_json"] and "תאורת בדיקה" not in a["details_json"]


def test_create_is_idempotent_per_client_request_id(autos_app):
    app, s, c, fake, tr = autos_app
    key = rid()
    body = {"draft": draft_of("חד־פעמית"), "client_request_id": key}
    r1 = c.post(f"{API}/automations/automation", json=body)
    r2 = c.post(f"{API}/automations/automation", json=body)
    assert r1.status_code == 201 and r2.status_code == 201 and r1.json()["item"]["id"] == r2.json()["item"]["id"] and len(tr.bridge_calls) == 1
    other = c.post(f"{API}/automations/script", json={"draft": {"alias": "x", "description": "", "mode": "single", "max": None, "icon": None, "fields": [], "sequence": [svc_block("light.turn_off", ["light.office"])]},
                                                     "client_request_id": key})
    assert other.status_code == 409 and other.json()["code"] == "idempotency_conflict"


def test_validation_errors_are_422_with_paths(autos_app):
    app, s, c, fake, tr = autos_app

    def post(draft):
        return create_item(c, "automation", draft)

    r = post(draft_of("x", triggers=[]))
    assert r.status_code == 422 and r.json()["code"] == "validation" and r.json()["details"]["errors"][0]["path"] == "triggers"
    r = post(draft_of("x", actions=[svc_block("light.turn_on", ["light.office"], {"brightness_pct": 400})]))
    assert r.status_code == 422 and r.json()["details"]["errors"][0]["path"] == "actions.0"
    r = post(draft_of("x", actions=[svc_block("light.turn_on", ["switch.hall_lights"])]))
    assert r.status_code == 422 and r.json()["code"] == "validation"
    r = post(draft_of("x", actions=[svc_block("homeassistant.turn_on", ["light.office"])]))
    assert r.status_code == 422 and r.json()["code"] == "action_not_allowed"
    r = post(draft_of("x", actions=[svc_block("shell_command.blink", [])]))
    assert r.status_code == 422 and r.json()["code"] == "action_not_allowed"
    r = post(draft_of("x", actions=[svc_block("alarm_control_panel.alarm_disarm", ["alarm_control_panel.shed_panel"], {"code": "1234"})]))
    assert r.status_code == 422 and r.json()["code"] == "code_not_allowed" and "1234" not in r.text
    r = post(draft_of("x", actions=[svc_block("notify.not_approved", [], {"message": "hi"}, role_="notify")]))
    assert r.status_code == 422 and r.json()["code"] == "action_not_allowed"
    r = post(draft_of("", actions=[svc_block("light.turn_on", ["light.office"])]))
    assert r.status_code == 422 and r.json()["details"]["errors"][0]["path"] == "alias"
    bad = draft_of("x")
    bad["triggers"][0]["type"] = "mqtt"
    assert post(bad).status_code == 422
    broken = draft_of("x")
    del broken["triggers"][0]["entity_ids"]
    assert post(broken).status_code == 422
    r = c.post(f"{API}/automations/automation", json={"draft": draft_of("x"), "client_request_id": rid(), "extra": 1})
    assert r.status_code == 422 and r.json()["code"] == "validation"
    r = c.post(f"{API}/automations/automation", content="{}", headers={"content-type": "text/plain"})
    assert r.status_code == 415
    assert not tr.bridge_calls


def test_notify_with_an_approved_target_is_typed(autos_app):
    app, s, c, fake, tr = autos_app
    r = create_item(c, "automation", draft_of("התראה", actions=[svc_block(NOTIFY, [], {"message": "שלום", "title": "בית"}, role_="notify")]))
    assert r.status_code == 201, r.text
    assert _file_item(fake, r.json()["item"]["config_id"])["actions"] == [{"action": NOTIFY, "data": {"message": "שלום", "title": "בית"}}]


# ================================================================ replace

def test_a_replace_changes_only_what_was_edited_and_round_trips_locked_blocks_byte_for_byte(autos_app):
    app, s, c, fake, tr = autos_app
    d = _detail(c, "תבניות – התראת טמפרטורה")
    before = copy.deepcopy(_file_item(fake, d["id"]))
    draft = _editable_draft(d)
    draft["alias"] = "שם חדש לתבניות"
    r = put_item(c, "automation", d["id"], draft, d["revision"], confirm=True)
    assert r.status_code == 200, r.text
    after = _file_item(fake, d["id"])
    assert model.canonical_json(after) == model.canonical_json({**before, "alias": "שם חדש לתבניות"}), "templates and the typed light step are untouched"
    assert r.json()["item"]["revision"] == model.revision_of(after) != d["revision"]
    call = tr.bridge_calls[-1]
    assert call["base_revision"] == d["revision"] and len(call["preserved"]) == 3 and call["profile"] == "builder"


def test_a_typed_edit_rebuilds_only_that_block(autos_app):
    app, s, c, fake, tr = autos_app
    d = _detail(c, "תאורה בפרוזדור בתנועה")
    draft = _editable_draft(d)
    draft["actions"][0]["data"]["brightness_pct"] = 80
    r = put_item(c, "automation", d["id"], draft, d["revision"])
    assert r.status_code == 200, r.text
    after = _file_item(fake, d["id"])
    assert after["actions"][0]["data"] == {"brightness_pct": 80} and after["actions"][1] == {"delay": {"hours": 0, "minutes": 5, "seconds": 0}}
    assert after["triggers"] == [{"trigger": "state", "entity_id": ["binary_sensor.motion_hall"], "to": "on", "id": "motion"}]


def test_a_legacy_item_is_written_in_the_new_schema_only_when_saved(autos_app):
    app, s, c, fake, tr = autos_app
    d = _detail(c, "פריט בסכמה ישנה")
    assert "trigger" in _file_item(fake, d["id"]) and "triggers" not in _file_item(fake, d["id"])
    draft = _editable_draft(d)
    draft["description"] = "עודכן"
    assert put_item(c, "automation", d["id"], draft, d["revision"]).status_code == 200
    after = _file_item(fake, d["id"])
    assert "triggers" in after and "trigger" not in after and "action" not in after and after["actions"][0]["action"] == "switch.turn_off" and after["description"] == "עודכן"
    assert after["triggers"][0]["trigger"] == "state"


def test_an_unchanged_replace_sends_nothing(autos_app):
    app, s, c, fake, tr = autos_app
    d = _detail(c, "מזגן סלון בבוקר")
    r = put_item(c, "automation", d["id"], _editable_draft(d), d["revision"])
    assert r.status_code == 200 and r.json()["op_id"] is None and not tr.bridge_calls


def test_a_stale_base_revision_is_409_with_the_current_item_and_drift_is_flagged(autos_app):
    app, s, c, fake, tr = autos_app
    d = _detail(c, "מזגן סלון בבוקר")
    draft = _editable_draft(d)
    draft["alias"] = "מקומי"
    _file_item(fake, d["id"])["alias"] = "שונה ב־HA"  # someone saved it in Home Assistant meanwhile
    r = put_item(c, "automation", d["id"], draft, d["revision"])
    assert r.status_code == 409 and r.json()["code"] == "item_changed"
    cur = r.json()["details"]["current"]
    assert cur["name"] == "שונה ב־HA" and r.json()["details"]["base_revision"] == d["revision"] and r.json()["details"]["current_revision"] == cur["revision"]
    assert not tr.bridge_calls
    assert any(w["code"] == "changed_outside" for w in cur["warnings"])
    assert put_item(c, "automation", d["id"], draft, cur["revision"]).status_code == 200


def test_the_bridge_rechecks_the_revision_under_its_lock(autos_app):
    app, s, c, fake, tr = autos_app
    d = _detail(c, "מזגן סלון בבוקר")
    draft = _editable_draft(d)
    draft["alias"] = "מקומי"
    orig_ws = tr.rest_config

    def racy(kind, config_id):  # HA changes the item AFTER the add-on's fresh read and BEFORE the bridge's write
        out = orig_ws(kind, config_id)
        _file_item(fake, d["id"])["description"] = "נכנס בין לבין"
        return out

    tr.rest_config = racy
    r = put_item(c, "automation", d["id"], draft, d["revision"])
    tr.rest_config = orig_ws
    assert r.status_code == 409 and r.json()["code"] == "item_changed" and r.json()["details"]["error"] == "stale"
    assert _file_item(fake, d["id"])["alias"] != "מקומי"


# ================================================================ locked blocks

def test_a_changed_or_invented_locked_block_is_refused(autos_app):
    app, s, c, fake, tr = autos_app
    d = _detail(c, "תבניות – התראת טמפרטורה")
    draft = _editable_draft(d)
    draft["triggers"][0]["raw"] = None
    draft["triggers"][0]["fingerprint"] = "0123456789abcdef"  # without its raw a block is only its fingerprint: not the stored one
    r = put_item(c, "automation", d["id"], draft, d["revision"], confirm=True)
    assert r.status_code == 403 and r.json()["code"] == "locked_block_changed"
    draft = _editable_draft(d)
    draft["triggers"][0]["raw"] = {"trigger": "template", "value_template": "{{ true }}"}  # a raw the stored item does not hold is a changed block, never written
    r = put_item(c, "automation", d["id"], draft, d["revision"], confirm=True)
    assert r.status_code == 403 and r.json()["code"] == "locked_block_changed"
    draft = _editable_draft(d)
    draft["triggers"][0]["fingerprint"] = "0123456789abcdef"  # the claimed fingerprint is recomputed from the raw: the stored raw wins
    ok = put_item(c, "automation", d["id"], draft, d["revision"], confirm=True)
    assert ok.status_code == 200 and model.canonical_json(_file_item(fake, d["id"])["triggers"]) == model.canonical_json(seed_triggers(d))
    draft = _editable_draft(d)
    draft["actions"].append({"uid": "x", "kind": "locked", "fingerprint": "feedfeedfeedfeed", "reason": "template", "label": "", "sensitive": False, "effects": "unknown", "masked": False, "raw": None, "sentence": ""})
    again = _detail(c, "תבניות – התראת טמפרטורה")
    assert put_item(c, "automation", d["id"], draft, again["revision"], confirm=True).status_code == 403


def seed_triggers(d):
    from automations_seed_s1 import automations

    return next(a for a in automations() if a["id"] == d["id"])["triggers"]


def test_locked_blocks_may_be_moved_or_deleted_but_unknown_effects_need_a_confirmation(autos_app):
    app, s, c, fake, tr = autos_app
    d = _detail(c, "תבניות – התראת טמפרטורה")
    draft = _editable_draft(d)
    draft["actions"] = list(reversed(draft["actions"]))
    r = put_item(c, "automation", d["id"], draft, d["revision"])
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required"
    r = put_item(c, "automation", d["id"], draft, d["revision"], confirm=True)
    assert r.status_code == 200 and [a["action"] for a in _file_item(fake, d["id"])["actions"] if "action" in a] == ["light.turn_on", "switch.turn_on"]
    d2 = _detail(c, "תבניות – התראת טמפרטורה")
    draft = _editable_draft(d2)
    draft["actions"] = [a for a in draft["actions"] if a["kind"] == "typed"]
    assert put_item(c, "automation", d2["id"], draft, d2["revision"]).status_code == 200  # the unknown-effect block is gone: nothing left to confirm


# ================================================================ the code view

def test_the_code_view_saves_a_template_as_a_code_profile_save(autos_app):
    app, s, c, fake, tr = autos_app
    d = _detail(c, "מזגן סלון בבוקר")
    cfg = copy.deepcopy(d["config"])
    cfg["conditions"].append({"condition": "template", "value_template": "{{ is_state('sun.sun', 'below_horizon') }}"})
    r = c.put(f"{API}/automations/automation/{d['id']}/code", json={"config": cfg, "base_revision": d["revision"], "confirm": True, "client_request_id": rid()})
    assert r.status_code == 200, r.text
    assert tr.bridge_calls[-1]["profile"] == "code" and _file_item(fake, d["id"])["conditions"][-1]["value_template"].startswith("{{")
    d2 = _detail(c, "מזגן סלון בבוקר")
    assert d2["locked_count"] == 1 and d2["draft"]["conditions"][-1]["template_text"].startswith("{{")


def test_the_code_view_with_only_typed_changes_is_a_builder_profile_save(autos_app):
    app, s, c, fake, tr = autos_app
    d = _detail(c, "מזגן סלון בבוקר")
    cfg = copy.deepcopy(d["config"])
    cfg["actions"][0]["data"]["temperature"] = 23
    r = c.put(f"{API}/automations/automation/{d['id']}/code", json={"config": cfg, "base_revision": d["revision"], "client_request_id": rid()})
    assert r.status_code == 200 and tr.bridge_calls[-1]["profile"] == "builder" and _file_item(fake, d["id"])["actions"][0]["data"]["temperature"] == 23


def test_the_code_view_refuses_secrets_masked_items_and_foreign_ids(autos_app):
    app, s, c, fake, tr = autos_app
    d = _detail(c, "מזגן סלון בבוקר")
    cfg = copy.deepcopy(d["config"])
    cfg["actions"][0]["data"]["token"] = "abc"
    r = c.put(f"{API}/automations/automation/{d['id']}/code", json={"config": cfg, "base_revision": d["revision"], "client_request_id": rid()})
    assert r.status_code == 422 and r.json()["code"] == "masked_values" and "abc" not in r.text
    sec = _detail(c, "ערך סודי בקריאה")
    r = c.put(f"{API}/automations/automation/{sec['id']}/code", json={"config": sec["config"], "base_revision": sec["revision"], "client_request_id": rid()})
    assert r.status_code == 422 and r.json()["code"] == "masked_values"
    cfg = copy.deepcopy(d["config"])
    cfg["id"] = "999"
    r = c.put(f"{API}/automations/automation/{d['id']}/code", json={"config": cfg, "base_revision": d["revision"], "client_request_id": rid()})
    assert r.status_code == 422
    cfg = copy.deepcopy(d["config"])
    cfg["actions"][0]["bogus_key"] = 1  # an unknown key makes the step a locked block: authored in the code view = a code-profile save, fine for an HA administrator
    r = c.put(f"{API}/automations/automation/{d['id']}/code", json={"config": cfg, "base_revision": d["revision"], "client_request_id": rid()})
    assert r.status_code == 200 and tr.bridge_calls[-1]["profile"] == "code"


# ================================================================ copy, delete, trash, versions

def test_copy_makes_a_new_item_with_a_new_id_and_name(autos_app):
    app, s, c, fake, tr = autos_app
    src = item_by_name(c, "מזגן סלון בבוקר")
    r = c.post(f"{API}/automations/automation/{src['id']}/copy", json={"name": "העתק של מזגן", "client_request_id": rid()})
    assert r.status_code == 201, r.text
    new = r.json()["item"]
    assert new["id"] != src["id"] and new["name"] == "העתק של מזגן" and new["created_via"] == "arx"
    stored = _file_item(fake, new["config_id"])
    assert stored["actions"] == _file_item(fake, src["id"])["actions"] and stored["id"] == new["config_id"]
    tpl = item_by_name(c, "תבניות – התראת טמפרטורה")
    r = c.post(f"{API}/automations/automation/{tpl['id']}/copy", json={"name": "העתק עם תבניות", "client_request_id": rid()})
    assert r.status_code in (201, 409), r.text  # locked content copied by an HA administrator with the code view: a code-profile create
    r = c.post(f"{API}/automations/automation/{src['id']}/copy", json={"name": "", "client_request_id": rid()})
    assert r.status_code == 422


def test_delete_goes_to_the_trash_and_restore_brings_it_back_with_the_same_id(autos_app):
    app, s, c, fake, tr = autos_app
    d = _detail(c, "מזגן סלון בבוקר")
    r = c.post(f"{API}/automations/automation/{d['id']}/delete", json={"base_revision": d["revision"], "client_request_id": rid()})
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required"
    before = copy.deepcopy(_file_item(fake, d["id"]))
    r = c.post(f"{API}/automations/automation/{d['id']}/delete", json={"base_revision": d["revision"], "confirm": True, "client_request_id": rid()})
    assert r.status_code == 200, r.text
    tid = r.json()["trash_id"]
    assert not any(str(i.get("id")) == d["id"] for i in fake.automations) and d["entity_id"] not in fake.states and get_item(c, "automation", d["id"]).status_code == 404
    assert all(x["service"] != "reload" or x["domain"] != "automation" or x["data"].get("id") != d["id"] for x in fake.calls[-1:]), "no reload after a delete"
    tr_list = c.get(f"{API}/automations/trash").json()["items"]
    assert [t["trash_id"] for t in tr_list] == [tid] and tr_list[0]["can_restore"] is True and tr_list[0]["name"] == "מזגן סלון בבוקר" and tr_list[0]["deleted_by"] == "joni" and tr_list[0]["config_id"] == d["id"] and tr_list[0]["sentence"]
    r = c.post(f"{API}/automations/trash/{tid}/restore", json={"client_request_id": rid()})
    assert r.status_code == 201, r.text
    assert r.json()["item"]["id"] == d["id"] and r.json()["id_changed"] is False and model.canonical_json(_file_item(fake, d["id"])) == model.canonical_json(before)
    assert c.get(f"{API}/automations/trash").json()["items"] == []
    assert c.post(f"{API}/automations/trash/{tid}/restore", json={"client_request_id": rid()}).status_code == 404


def test_a_trashed_item_with_a_hidden_secret_cannot_be_restored_and_purge_needs_confirmation(autos_app):
    app, s, c, fake, tr = autos_app
    d = _detail(c, "ערך סודי בקריאה")
    r = c.post(f"{API}/automations/automation/{d['id']}/delete", json={"base_revision": d["revision"], "confirm": True, "client_request_id": rid()})
    assert r.status_code == 200
    tid = r.json()["trash_id"]
    with app.state.db.connection() as conn:
        assert "abc-not-real" not in conn.execute("SELECT config_json FROM automation_trash").fetchone()[0]
    assert c.get(f"{API}/automations/trash").json()["items"][0]["can_restore"] is False
    assert c.post(f"{API}/automations/trash/{tid}/restore", json={"client_request_id": rid()}).json()["code"] == "masked_values"
    assert c.post(f"{API}/automations/trash/{tid}/purge", json={}).json()["code"] == "confirmation_required"
    assert c.post(f"{API}/automations/trash/{tid}/purge", json={"confirm": True}).status_code == 200 and c.get(f"{API}/automations/trash").json()["items"] == []


def test_versions_are_kept_and_a_version_can_be_restored(autos_app):
    app, s, c, fake, tr = autos_app
    d = _detail(c, "מזגן סלון בבוקר")
    draft = _editable_draft(d)
    draft["actions"][0]["data"]["temperature"] = 22
    assert put_item(c, "automation", d["id"], draft, d["revision"]).status_code == 200
    vs = c.get(f"{API}/automations/automation/{d['id']}/versions").json()["items"]
    assert len(vs) == 2 and vs[0]["current"] is True and vs[0]["via"] == "arx" and vs[1]["via"] == "external"
    cur = _detail(c, "מזגן סלון בבוקר")
    r = c.post(f"{API}/automations/automation/{d['id']}/versions/{vs[1]['version_id']}/restore", json={"base_revision": cur["revision"], "client_request_id": rid()})
    assert r.status_code == 200, r.text
    assert _file_item(fake, d["id"])["actions"][0]["data"]["temperature"] == 24
    assert c.post(f"{API}/automations/automation/{d['id']}/versions/9999/restore", json={"client_request_id": rid()}).status_code == 404


def test_the_version_history_is_capped_by_the_setting(autos_app):
    app, s, c, fake, tr = autos_app
    assert c.patch(f"{API}/settings", json={"automations.versions_keep": 5}).status_code == 200
    d = _detail(c, "מזגן סלון בבוקר")
    rev = d["revision"]
    for t in range(15, 22):
        draft = _editable_draft(get_item(c, "automation", d["id"]).json())
        draft["actions"][0]["data"]["temperature"] = t
        r = put_item(c, "automation", d["id"], draft, rev)
        assert r.status_code == 200
        rev = r.json()["item"]["revision"]
    assert len(c.get(f"{API}/automations/automation/{d['id']}/versions").json()["items"]) == 5


# ================================================================ runtime

def test_enable_disable_and_run(autos_app):
    app, s, c, fake, tr = autos_app
    it = item_by_name(c, "מזגן סלון בבוקר")
    r = c.post(f"{API}/automations/automation/{it['id']}/disable", json={"client_request_id": rid()})
    assert r.status_code == 200 and r.json()["item"]["state"] == "off"
    assert fake.calls[-1]["service"] == "turn_off" and fake.calls[-1]["user_id"] == "dev-joni"
    r = c.post(f"{API}/automations/automation/{it['id']}/enable", json={"client_request_id": rid()})
    assert r.status_code == 200 and r.json()["item"]["state"] == "on"
    r = c.post(f"{API}/automations/automation/{it['id']}/run", json={"client_request_id": rid(), "confirm": True})
    assert r.status_code == 202 and r.json()["run_id"] and fake.calls[-1]["service"] == "trigger" and fake.calls[-1]["data"]["skip_condition"] is True
    r = c.post(f"{API}/automations/automation/{it['id']}/run", json={"client_request_id": rid(), "confirm": True})
    assert r.status_code == 429 and r.json()["code"] == "run_too_soon"
    assert c.post(f"{API}/automations/automation/{it['id']}/run", json={"client_request_id": rid(), "confirm": True, "skip_condition": False}).status_code == 429
    noid = item_by_name(c, "אוטומציה בלי מזהה")
    assert c.post(f"{API}/automations/automation/{noid['id']}/disable", json={"client_request_id": rid()}).status_code == 422


def test_running_an_automation_with_unknown_effects_needs_confirmation(autos_app):
    app, s, c, fake, tr = autos_app
    tpl = item_by_name(c, "תבניות – התראת טמפרטורה")
    r = c.post(f"{API}/automations/automation/{tpl['id']}/run", json={"client_request_id": rid()})
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required"
    assert c.post(f"{API}/automations/automation/{tpl['id']}/run", json={"client_request_id": rid(), "confirm": True}).status_code == 202


def test_scripts_run_with_fields_and_stop(autos_app):
    app, s, c, fake, tr = autos_app
    sc = item_by_name(c, "קירור עם פרמטרים")
    r = c.post(f"{API}/automations/script/{sc['id']}/run", json={"client_request_id": rid(), "fields": {"temp": 99}})
    assert r.status_code == 422 and r.json()["details"]["path"] == "temp"
    assert c.post(f"{API}/automations/script/{sc['id']}/run", json={"client_request_id": rid(), "fields": {"nope": 1}}).status_code == 422
    assert c.post(f"{API}/automations/script/{sc['id']}/run", json={"client_request_id": rid(), "fields": {"temp": "{{ 1 }}"}}).status_code == 422
    r = c.post(f"{API}/automations/script/{sc['id']}/run", json={"client_request_id": rid(), "fields": {"temp": 22, "quiet": True, "mode_pick": "cool"}})
    assert r.status_code == 202 and fake.calls[-1] == {"domain": "script", "service": "turn_on", "data": {"variables": {"temp": 22, "quiet": True, "mode_pick": "cool"}, "entity_id": "script.set_cooling"},
                                                       "user_id": "dev-joni"}
    assert c.post(f"{API}/automations/script/{sc['id']}/stop", json={"client_request_id": rid()}).status_code == 202 and fake.calls[-1]["service"] == "turn_off"
    alarm_script = item_by_name(c, "לילה טוב")
    assert c.post(f"{API}/automations/script/{alarm_script['id']}/run", json={"client_request_id": rid()}).json()["code"] == "confirmation_required"
    assert c.post(f"{API}/automations/script/{alarm_script['id']}/run", json={"client_request_id": rid(), "confirm": True}).status_code == 202


def test_scenes_apply_integration_and_native(autos_app):
    app, s, c, fake, tr = autos_app
    wall = item_by_name(c, "wall scene 03", "scene")
    r = c.post(f"{API}/automations/scene/{wall['id']}/apply", json={"client_request_id": rid()})
    assert r.status_code == 202 and fake.calls[-1] == {"domain": "scene", "service": "turn_on", "data": {"entity_id": "scene.wall_scene_03"}, "user_id": "dev-joni"}
    native = item_by_name(c, "ערב בסלון", "scene")
    assert c.post(f"{API}/automations/scene/{native['id']}/apply", json={"client_request_id": rid()}).status_code == 202
    assert fake.states["switch.hall_lights"]["state"] == "on"
    assert c.post(f"{API}/automations/scene/{native['id']}/apply", json={"client_request_id": rid()}).status_code == 429


def test_scenes_and_scripts_can_be_created_edited_and_deleted(autos_app):
    app, s, c, fake, tr = autos_app
    members = [{"entity_id": "light.office", "state": "on", "attributes": {"brightness": 120}}, {"entity_id": "switch.hall_lights", "state": "off", "attributes": {}}]
    r = c.post(f"{API}/automations/scene", json={"draft": {"name": "סצנת בדיקה", "icon": None, "members": members}, "client_request_id": rid()})
    assert r.status_code == 201, r.text
    sc = r.json()["item"]
    assert sc["state"] == "scene" and sc["kind"] == "scene" and fake.scenes[-1]["entities"] == {"light.office": {"state": "on", "brightness": 120}, "switch.hall_lights": {"state": "off"}}
    assert sc["draft"]["members"][0]["attributes"] == {"brightness": 120}
    assert any(x["service"] == "reload" and x["domain"] == "scene" for x in fake.calls)
    draft = copy.deepcopy(sc["draft"])
    draft["members"][0]["attributes"]["brightness"] = 200
    r = put_item(c, "scene", sc["id"], draft, sc["revision"])
    assert r.status_code == 200 and fake.scenes[-1]["entities"]["light.office"]["brightness"] == 200
    r = c.post(f"{API}/automations/script", json={"draft": {"alias": "סקריפט בדיקה", "description": "", "mode": "single", "max": None, "icon": "mdi:light", "fields": [
        {"key": "level", "name": "רמה", "required": False, "default": 5, "selector": {"kind": "number", "min": 1, "max": 10}}], "sequence": [svc_block("light.turn_off", ["light.office"])]},
        "client_request_id": rid()})
    assert r.status_code == 201, r.text
    script = r.json()["item"]
    assert script["id"].startswith("arx_") and fake.scripts[script["id"]]["fields"]["level"]["selector"] == {"number": {"min": 1, "max": 10}} and fake.scripts[script["id"]]["icon"] == "mdi:light"
    d = get_item(c, "scene", sc["id"]).json()
    r = c.post(f"{API}/automations/scene/{sc['id']}/delete", json={"base_revision": d["revision"], "confirm": True, "client_request_id": rid()})
    assert r.status_code == 200 and all(str(i.get("id")) != sc["id"] for i in fake.scenes)
    d = get_item(c, "script", script["id"]).json()
    assert c.post(f"{API}/automations/script/{script['id']}/delete", json={"base_revision": d["revision"], "confirm": True, "client_request_id": rid()}).status_code == 200 and script["id"] not in fake.scripts


def test_a_script_id_is_an_ascii_slug_of_the_alias_when_free(autos_app):
    app, s, c, fake, tr = autos_app
    draft = {"alias": "Night Mode", "description": "", "mode": "single", "max": None, "icon": None, "fields": [], "sequence": [svc_block("light.turn_off", ["light.office"])]}
    r = c.post(f"{API}/automations/script", json={"draft": draft, "client_request_id": rid()})
    assert r.status_code == 201 and r.json()["item"]["id"] == "night_mode"
    r = c.post(f"{API}/automations/script", json={"draft": draft, "client_request_id": rid()})
    assert r.status_code == 201 and r.json()["item"]["id"].startswith("arx_")


# ================================================================ refusals on the way

def test_a_self_triggering_save_needs_confirmation_and_forces_single_mode(autos_app):
    app, s, c, fake, tr = autos_app
    draft = draft_of("לולאה", triggers=[typed_state_trigger("light.office", "on")], actions=[svc_block("light.turn_off", ["light.office"])], mode="parallel")
    r = create_item(c, "automation", draft)
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required" and r.json()["details"]["self_trigger"] is True
    r = create_item(c, "automation", draft, confirm=True)
    assert r.status_code == 201
    stored = _file_item(fake, r.json()["item"]["config_id"])
    assert stored["mode"] == "single" and "max" not in stored and any(w["code"] == "self_trigger" for w in r.json()["item"]["warnings"])


def test_homeassistants_own_validator_can_refuse(autos_app):
    app, s, c, fake, tr = autos_app
    d = _detail(c, "מזגן סלון בבוקר")
    cfg = copy.deepcopy(d["config"])
    cfg["triggers"].append({"trigger": "bogus_platform"})  # a code-view block Home Assistant itself does not know
    pv = c.post(f"{API}/automations/preview", json={"kind": "automation", "id": d["id"], "config": cfg}).json()
    assert pv["ha_validation"] == "failed" and pv["valid"] is False
    r = c.put(f"{API}/automations/automation/{d['id']}/code", json={"config": cfg, "base_revision": d["revision"], "confirm": True, "client_request_id": rid()})
    assert r.status_code == 422 and r.json()["code"] == "ha_validation" and "triggers" in r.json()["details"]["path"] and "bogus_platform" not in r.text
    assert _file_item(fake, d["id"])["triggers"] == [{"trigger": "time", "at": "07:00:00"}], "nothing was written"


def test_an_item_that_never_loads_is_taken_out_again_and_authoring_is_blocked(autos_app):
    app, s, c, fake, tr = autos_app
    fake.include_loaded = False  # the include line of automations.yaml is missing: a reload loads nothing (U-5)
    n = len(fake.automations)
    r = create_item(c, "automation", draft_of("לא נטען"))
    assert r.status_code == 202 and r.json()["status"] == "not_loaded", r.text
    assert len(fake.automations) == n, "the bridge took the orphan out of the file again"
    assert tr.bridge_calls[-1]["op"] == "upsert"
    st = c.get(f"{API}/automations/status").json()
    assert st["write_block"] == "authoring_blocked" and st["admin"]["authoring_block_reason"] == "not_loaded" and st["writable"] is False
    r = create_item(c, "automation", draft_of("אחרי החסימה"))
    assert r.status_code == 503 and r.json()["code"] == "config_api_unavailable"
    rv = c.get(f"{API}/automations/review").json()["items"]
    assert any(x["issue"] == "not_loaded" for x in rv)
    # an administrator's fix (the include line, a reload a minute or more later) lifts the block
    fake.include_loaded = True
    automations.MIRROR.clock = lambda: fake.now() + dt.timedelta(minutes=2)
    automations.MIRROR.on_ha_event({"event": {"event_type": "automation_reloaded", "data": {}, "time_fired": fake.iso()}})
    assert c.get(f"{API}/automations/status").json()["write_block"] is None
    assert create_item(c, "automation", draft_of("אחרי התיקון")).status_code == 201


def test_the_authoring_block_survives_its_own_reload_and_lifts_after_a_minute_on_a_new_session(autos_app):
    """Owner OK 2026-10-01: recovery after 60 s. The failed write's own reload (and a reconnect inside the minute) keeps the block; the include line lives in
    configuration.yaml, which Home Assistant reads at start, so a new session (pull reason `connect`) a minute or more later lifts it like a late reload does."""
    app, s, c, fake, tr = autos_app
    fake.include_loaded = False
    assert create_item(c, "automation", draft_of("לא נטען")).status_code == 202
    base = fake.now()
    automations.MIRROR.clock = lambda: base + dt.timedelta(seconds=20)
    automations.MIRROR.on_ha_event({"event": {"event_type": "automation_reloaded", "data": {}, "time_fired": fake.iso()}})
    automations.MIRROR.pull(None, "connect")
    assert c.get(f"{API}/automations/status").json()["write_block"] == "authoring_blocked", "inside the minute nothing lifts the block"
    automations.MIRROR.clock = lambda: base + dt.timedelta(seconds=90)
    automations.MIRROR.pull(None, "periodic")
    assert c.get(f"{API}/automations/status").json()["write_block"] == "authoring_blocked", "the 10-minute pull is not a fix"
    fake.include_loaded = True  # the administrator added the include line and restarted Home Assistant
    automations.MIRROR.pull(None, "connect")
    assert c.get(f"{API}/automations/status").json()["write_block"] is None
    assert create_item(c, "automation", draft_of("אחרי ההפעלה מחדש")).status_code == 201


def test_the_bridge_state_blocks_writes(autos_app):
    app, s, c, fake, tr = autos_app
    with app.state.db.connection() as conn:
        set_setting(conn, "bridge.integration_version", "0.5.0")
    r = create_item(c, "automation", draft_of("x"))
    assert r.status_code == 503 and r.json()["code"] == "bridge_too_old"
    assert c.get(f"{API}/automations/status").json()["write_block"] == "bridge_too_old"
    with app.state.db.connection() as conn:
        set_setting(conn, "bridge.integration_version", "0.6.0")
        set_setting(conn, "bridge.paired_at", "")
    assert create_item(c, "automation", draft_of("x")).json()["code"] == "bridge_not_paired"
    with app.state.db.connection() as conn:
        set_setting(conn, "bridge.paired_at", "2026-10-01T00:00:00Z")
    tr.up = False
    r = create_item(c, "automation", draft_of("x"))
    assert r.status_code == 503 and r.json()["code"] == "ha_unavailable"
    assert c.get(f"{API}/automations/status").json()["available"] == "ha_unavailable"
    tr.up = True
    assert c.patch(f"{API}/settings", json={"automations.enabled": "false"}).status_code == 200
    r = create_item(c, "automation", draft_of("x"))
    assert r.status_code == 409 and r.json()["code"] == "feature_disabled" and c.get(f"{API}/automations/status").json()["available"] == "feature_disabled"


def test_a_timeout_is_504_the_op_is_unknown_and_nothing_is_retried(autos_app):
    app, s, c, fake, tr = autos_app
    key = rid()
    tr.fail_next["timeout"] = True
    body = {"draft": draft_of("איטית"), "client_request_id": key}
    r = c.post(f"{API}/automations/automation", json=body)
    assert r.status_code == 504 and r.json()["code"] == "config_timeout"
    again = c.post(f"{API}/automations/automation", json=body)
    assert again.status_code == 202 and again.json()["status"] == "unknown" and len(tr.bridge_calls) == 1
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT status FROM automation_ops WHERE client_request_id = ?", (key,)).fetchone()[0] == "unknown"


def test_a_failed_write_never_leaves_the_file_half_written(autos_app, monkeypatch):
    import bridge_loader

    app, s, c, fake, tr = autos_app
    store = bridge_loader.load("config_store")
    real = store.ConfigStore._atomic_write
    before = copy.deepcopy(fake.automations)

    def failing(p, text):  # the add-on's own item is in the text of the write the bridge makes (not of the harness's file sync)
        if "נכשלת" in text:
            raise OSError("disk")
        return real(p, text)

    monkeypatch.setattr(store.ConfigStore, "_atomic_write", staticmethod(failing))
    r = create_item(c, "automation", draft_of("נכשלת"))
    assert r.status_code == 502 and r.json()["code"] == "config_refused" and r.json()["details"]["error"] == "write_failed" and fake.automations == before
    state = {"n": 0}

    def corrupt(p, text):  # a write that does not read back as what was meant: the previous file is put back
        if "נכשלת שוב" in text and state["n"] == 0:
            state["n"] += 1
            return real(p, "[]\n")
        return real(p, text)

    monkeypatch.setattr(store.ConfigStore, "_atomic_write", staticmethod(corrupt))
    r = create_item(c, "automation", draft_of("נכשלת שוב"))
    assert r.status_code == 502 and r.json()["details"]["error"] == "write_failed" and fake.automations == before


def test_items_that_are_not_in_the_editors_file_are_view_only(autos_app):
    app, s, c, fake, tr = autos_app
    y = item_by_name(c, "אוטומציה מקובץ תצורה")
    d = get_item(c, "automation", y["id"]).json()
    assert d["can"]["edit"] is False and d["draft"]["triggers"][0]["type"] == "time"
    r = put_item(c, "automation", y["id"], d["draft"], d["revision"])
    assert r.status_code == 422 and r.json()["code"] == "not_editable"
    assert c.post(f"{API}/automations/automation/{y['id']}/delete", json={"base_revision": d["revision"], "confirm": True, "client_request_id": rid()}).json()["code"] == "not_editable"
    assert c.post(f"{API}/automations/automation/{y['id']}/disable", json={"client_request_id": rid()}).status_code == 200, "run / enable / disable still work"
    wall = item_by_name(c, "wall scene 05", "scene")
    assert put_item(c, "scene", wall["id"], {"name": "x", "icon": None, "members": []}, "x").json()["code"] == "not_editable"
    assert not [b for b in tr.bridge_calls if b["op"] in ("upsert", "delete")], "a view-only item never reaches a write"


def test_a_bridge_not_found_marks_the_item_view_only(autos_app):
    app, s, c, fake, tr = autos_app
    d = _detail(c, "מזגן סלון בבוקר")
    fake.automations = [i for i in fake.automations if str(i.get("id")) != d["id"]]  # the file no longer holds it (moved to a package)
    draft = _editable_draft(d)
    draft["alias"] = "x"
    r = put_item(c, "automation", d["id"], draft, d["revision"])
    assert r.status_code in (404, 422), r.text


def test_the_settings_of_the_automations_tab(autos_app):
    app, s, c, fake, tr = autos_app
    got = c.get(f"{API}/settings").json()["settings"]
    assert got["automations.enabled"] == "true" and got["automations.trash_days"] == 30 and got["automations.versions_keep"] == 20 and got["automations.code_view_roles"] == ["site_admin", "system_admin"]
    assert got["automations.limits"] == {"writes_per_min": 30, "preview_per_min": 60, "run_interval_s": 10, "scene_apply_interval_s": 3, "storm_item_per_min": 20, "storm_total_per_min": 200}
    assert got["automations.sensitive_warning"] == "true" and got["automations.storm_auto_disable"] == "false" and got["automations.ask_when_on_new"] == "false"
    assert got["automations.phone_filter"] == "fold" and got["automations.sensitive_chip"] == "amber"
    r = c.patch(f"{API}/settings", json={"automations.phone_filter": "rows", "automations.sensitive_chip": "red", "automations.trash_days": 60, "automations.limits": {"writes_per_min": 5},
                                          "automations.code_view_roles": ["site_admin"], "automations.notify_targets": [NOTIFY, "notify.family"]})
    assert r.status_code == 200
    got = r.json()["settings"]
    assert got["automations.phone_filter"] == "rows" and got["automations.sensitive_chip"] == "red" and got["automations.trash_days"] == 60
    assert got["automations.limits"]["writes_per_min"] == 5 and got["automations.limits"]["run_interval_s"] == 10 and got["automations.notify_targets"] == [NOTIFY, "notify.family"]
    assert c.get(f"{API}/automations/status").json()["ui"]["phone_filter"] == "rows"
    for bad in ({"automations.phone_filter": "grid"}, {"automations.sensitive_chip": "blue"}, {"automations.trash_days": 3}, {"automations.versions_keep": 100}, {"automations.limits": {"writes_per_min": 0}},
                {"automations.limits": {"nope": 1}}, {"automations.code_view_roles": ["bad role"]}, {"automations.notify_targets": ["light.x"]}, {"automations.templates_hidden": "x"}):
        assert c.patch(f"{API}/settings", json=bad).status_code == 422, bad
    omer = c.patch(f"{API}/settings", json={"automations.enabled": "false"}, headers=OMER)
    assert omer.status_code == 403


def test_the_write_rate_limit_is_a_setting(autos_app):
    app, s, c, fake, tr = autos_app
    assert c.patch(f"{API}/settings", json={"automations.limits": {"writes_per_min": 2}}).status_code == 200
    codes = [create_item(c, "automation", draft_of(f"נ{i}")).status_code for i in range(3)]
    assert codes == [201, 201, 429]
    r = create_item(c, "automation", draft_of("עוד"))
    assert r.json()["code"] == "rate_limited"
