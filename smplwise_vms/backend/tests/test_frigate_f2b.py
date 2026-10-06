"""NN5 F2b - the F2 leftovers, end to end against the in-process fake Frigate (`fixtures/fake_frigate.py`; never a real Frigate):
automatic profile switching on an alarm-state change (off / suggest / apply, consent, first supervised write, expiry, undo), Frigate-native
exports and cases (classes `exports` / `cases`, ownership, confirmation on delete, read-back, undo), manual events (class `events`), the
first-supervised-write flag, and the proof that none of the new calls is reachable through the read allow-list."""
from __future__ import annotations

import sys
import time
from pathlib import Path

import pytest

from smplwise.services import frigate_auto_profile as auto
from smplwise.services import frigate_control_svc as svc
from smplwise.services import frigate_native_svc as native
from smplwise.services import ha_sync
from smplwise.services.recorders import frigate as fr
from smplwise.services.recorders import frigate_http as fh

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from conftest import as_user, bind  # noqa: E402
from fake_frigate import T0  # noqa: E402
from test_frigate_control import BASE, World, _clean, world  # noqa: E402,F401  (fixtures)

EXPORT = {"start": T0 - 600, "end": T0 - 300, "name": "Front door evening"}


def _export(w: World, cam="cam_front", supervised=True, headers=None, **over):
    body = {"camera_id": w.cams()[cam], **EXPORT, "supervised": supervised, **over}
    return w.call("POST", f"{BASE}/exports", json=body, headers=headers or {})


def _alarm(w: World, old: str, new: str) -> None:
    def st(s):
        return {"entity_id": "alarm_control_panel.home", "state": s, "attributes": {"friendly_name": "Home"}, "last_changed": "2026-10-06T10:00:00+00:00"}

    ha_sync.handle_state_event(w.app.state.db, {"old_state": st(old), "new_state": st(new)})


def _adapter(w: World) -> fr.FrigateAdapter:
    return fr.FrigateAdapter("nvr-1", w.s, transport=w.fake.transport())


def _tick(w: World, now: float | None = None):
    return auto.tick(w.app.state.db, _adapter(w), time.time() if now is None else now)


def _auto(w: World, **body):
    r = w.call("PUT", f"{BASE}/profile-auto/setting", json=body)
    assert r.status_code == 200, r.text
    return r.json()["setting"]


def _items(w: World):
    return w.call("GET", f"{BASE}/profile-auto").json()["items"]


# ---------------------------------------------------------------------------------------------- defaults, allow-lists, permissions

def test_the_new_classes_are_off_by_default_and_listed_with_their_confirm_actions(world):
    pol = world.call("GET", f"{BASE}/control/policy").json()
    by = {c["class"]: c for c in pol["classes"]}
    assert by["exports"]["enabled"] is False and by["cases"]["enabled"] is False
    assert by["exports"]["confirm_actions"] == ["delete"] and by["cases"]["permission"] == "analytics.cases" and by["exports"]["per_action"] is False
    assert _auto_default(world) == {"mode": "off", "auto_apply_consent": False, "will_apply": False}
    r = _export(world)
    assert r.status_code == 409 and r.json()["code"] == "frigate_write_class_off"
    assert world.call("POST", f"{BASE}/cases", json={"name": "x", "supervised": True}).json()["code"] == "frigate_write_class_off"
    assert world.call("POST", f"{BASE}/cameras/{world.cams()['cam_front']}/events/manual", json={"label": "person", "supervised": True}).json()["code"] == "frigate_write_class_off"
    assert world.fake.non_get == ["POST /api/login"] and world.fake.writes == []


def _auto_default(w: World) -> dict:
    s = w.call("GET", f"{BASE}/profile-auto").json()["setting"]
    return {k: s[k] for k in ("mode", "auto_apply_consent", "will_apply")}


def test_none_of_the_new_calls_is_reachable_through_the_read_allow_list(world):
    http = fh.FrigateHttp("nvr-1", world.s, transport=world.fake.transport())
    for path in ("/api/exports", "/api/cases", "/api/export/cam_front/start/1/end/2", "/api/export/x_1/rename", "/api/events/cam_front/person/create", "/api/events/1791228001.000001-man001/end"):
        assert not fh.allowed(path), path
        with pytest.raises(fh.ApiError):
            http.get(path)
    assert fh.control_read_allowed("/api/exports") and fh.control_read_allowed("/api/cases") and not fh.control_read_allowed("/api/export/x_1/rename")
    for klass, method, path in [("exports", "DELETE", "/api/events/1791228001.000001-man001"), ("exports", "POST", "/api/cases"), ("cases", "POST", "/api/exports"), ("cases", "DELETE", "/api/export/x_1"),
                                ("events", "DELETE", "/api/export/x_1"), ("analytics", "POST", "/api/cases"), ("exports", "DELETE", "/api/export/x/../y"), ("exports", "PUT", "/api/export/x_1/rename"),
                                ("exports", "POST", "/api/export/cam_front/start/1/end/2/extra"), ("events", "POST", "/api/events/cam_front/per son/create"), ("events", "PUT", "/api/events/not-an-id/end"),
                                ("cases", "DELETE", "/api/cases"), ("exports", "DELETE", "/api/exports")]:
        with pytest.raises(fh.ApiError) as e:
            http.write(klass, method, path, {})
        assert e.value.code == "frigate_path_not_allowed", (klass, method, path)
    assert world.fake.writes == [] and world.fake.non_get == ["POST /api/login"]


def test_the_new_permissions_belong_to_the_administrators_only(world):
    bind(world.c, world.s, "lena", "operator", "installation", "*")
    h = as_user("lena")
    world.policy(exports=True, cases=True, events=True)
    assert _export(world, headers=h).status_code == 403
    assert world.call("POST", f"{BASE}/cases", json={"name": "x", "supervised": True}, headers=h).status_code == 403
    assert world.call("GET", f"{BASE}/exports", headers=h).status_code == 403 and world.call("GET", f"{BASE}/cases", headers=h).status_code == 403
    assert world.call("PUT", f"{BASE}/profile-auto/setting", json={"mode": "suggest"}, headers=h).status_code == 403
    bind(world.c, world.s, "tal", "site_admin", "installation", "*")
    assert _export(world, headers=as_user("tal"), supervised=False).json()["code"] == "frigate_first_write_unsupervised"
    assert world.fake.writes == []


# ---------------------------------------------------------------------------------------------- the first supervised write

def test_the_first_write_of_a_kind_needs_a_supervising_administrator_and_is_remembered(world):
    world.policy(exports=True)
    refused = _export(world, supervised=False)
    assert refused.status_code == 409 and refused.json()["code"] == "frigate_first_write_unsupervised" and world.fake.writes == []
    assert world.audit("frigate.control.export_create")[-1]["reason"] == "first_write_unsupervised"
    fw = world.call("GET", f"{BASE}/control/first-writes").json()
    assert fw["done"]["export_create"] is False and fw["can_supervise"] is True
    bind(world.c, world.s, "tal", "site_admin", "installation", "*")
    assert _export(world, headers=as_user("tal")).status_code == 403, "supervised: true from a site administrator without system.configure does not count"
    ok = _export(world)
    assert ok.status_code == 200 and ok.json()["verified"] is True
    assert world.call("GET", f"{BASE}/control/first-writes").json()["done"]["export_create"] is True
    second = _export(world, supervised=False, name="Second")
    assert second.status_code == 200, "after the first supervised write of this kind the flag is no longer asked"
    assert world.call("GET", f"{BASE}/control/first-writes").json()["done"]["export_rename"] is False, "kinds are separate"


# ---------------------------------------------------------------------------------------------- exports

def test_an_export_is_created_read_back_listed_renamed_and_deleted_with_a_confirmation(world):
    world.policy(exports=True)
    r = _export(world).json()
    eid = r["export_id"]
    assert r["verified"] is True and eid.startswith("cam_front_")
    assert world.fake.writes[-1] == ("POST", f"/api/export/cam_front/start/{EXPORT['start']:.3f}/end/{EXPORT['end']:.3f}", {"name": "Front door evening", "playback": "realtime"})
    lst = world.call("GET", f"{BASE}/exports")
    assert lst.status_code == 200
    rows = {x["id"]: x for x in lst.json()["exports"]}
    assert rows[eid]["arx_created"] is True and rows["cam_front_foreign"]["arx_created"] is False and rows[eid]["camera_id"] == world.cams()["cam_front"]
    assert "video_path" not in lst.text and "/media/frigate" not in lst.text, "Frigate's file paths never leave the adapter"
    ren = world.call("PATCH", f"{BASE}/exports/{eid}", json={"name": "Renamed", "supervised": True}).json()
    assert ren["changed"] is True and ren["verified"] is True and next(x for x in world.fake.exports if x["id"] == eid)["name"] == "Renamed"
    assert world.call("PATCH", f"{BASE}/exports/{eid}", json={"name": "Renamed"}).json()["changed"] is False
    no = world.call("POST", f"{BASE}/exports/{eid}/delete", json={"supervised": True})
    assert no.status_code == 409 and no.json()["code"] == "confirmation_required" and any(x["id"] == eid for x in world.fake.exports)
    gone = world.call("POST", f"{BASE}/exports/{eid}/delete", json={"confirm": True, "supervised": True}).json()
    assert gone["deleted"] is True and gone["verified"] is True and [x["id"] for x in world.fake.exports] == ["cam_front_foreign"]
    log = world.changes()
    assert [c["kind"] for c in log[:3]] == ["export_delete", "export_rename", "export_create"] and all(c["class"] == "exports" for c in log[:3])
    assert log[0]["reversible"] is False and log[2]["status"] == "applied" and log[2]["after"]["id"] == eid
    assert [a["decision"] for a in world.audit("frigate.control.exports")] == ["allowed"] * 3
    assert world.call("POST", f"{BASE}/exports/{eid}/delete", json={"confirm": True}).json()["code"] == "frigate_object_not_arx", "forgotten after the delete"


def test_arx_never_renames_or_deletes_an_export_it_did_not_create(world):
    world.policy(exports=True, cases=True)
    for call in (world.call("PATCH", f"{BASE}/exports/cam_front_foreign", json={"name": "mine now", "supervised": True}),
                 world.call("POST", f"{BASE}/exports/cam_front_foreign/delete", json={"confirm": True, "supervised": True}),
                 world.call("PATCH", f"{BASE}/cases/case_foreign", json={"name": "mine now", "supervised": True}),
                 world.call("POST", f"{BASE}/cases/case_foreign/delete", json={"confirm": True, "supervised": True})):
        assert call.status_code == 409 and call.json()["code"] == "frigate_object_not_arx"
    assert world.fake.writes == [] and world.fake.exports[0]["name"] == "made in Frigate" and world.fake.cases[0]["name"] == "made in Frigate"


def test_an_export_whose_answer_has_no_id_is_found_by_name_and_a_bad_range_is_refused(world):
    world.policy(exports=True)
    world.fake.export_reply_id = False
    r = _export(world).json()
    assert r["verified"] is True and r["export_id"] and any(x["id"] == r["export_id"] for x in world.fake.exports)
    n = len(world.fake.writes)
    for over in ({"end": EXPORT["start"] - 1}, {"end": EXPORT["start"] + 7300}, {"end": time.time() + 4000, "start": time.time() + 3000}, {"name": ""}, {"name": "x" * 81}):
        assert _export(world, **over).status_code in (409, 422), over
    assert len(world.fake.writes) == n


def test_an_export_is_limited_to_the_cameras_of_the_binding_and_the_list_is_filtered(world):
    cams = world.cams()
    world.policy(exports=True)
    world.fake.exports.append({"id": "cam_yard_foreign", "camera": "cam_yard", "name": "yard", "date": 1.0, "in_progress": False, "export_case_id": None})
    bind(world.c, world.s, "tal", "system_admin", "camera", cams["cam_front"])
    h = as_user("tal")
    assert _export(world, "cam_yard", headers=h).status_code == 403
    assert _export(world, "cam_front", headers=h, supervised=False).json()["code"] == "frigate_first_write_unsupervised"
    ids = {x["id"] for x in world.call("GET", f"{BASE}/exports", headers=h).json()["exports"]}
    assert "cam_front_foreign" in ids and "cam_yard_foreign" not in ids


def test_an_export_failure_is_logged_failed_and_never_repeated_and_a_lost_answer_is_unknown(world):
    world.policy(exports=True)
    world.fake.write_status = 500
    r = _export(world)
    assert r.status_code == 503
    assert len([h for h in world.fake.hits if h.startswith("POST /api/export/")]) == 1
    assert world.changes()[0]["status"] == "failed" and world.changes()[0]["reversible"] is False
    assert world.call("GET", f"{BASE}/control/first-writes").json()["done"]["export_create"] is False, "a failed first write does not count as supervised"
    world.fake.write_role_ok = False
    assert _export(world).json()["code"] == "frigate_write_forbidden"


def test_an_export_creation_is_undone_by_deleting_it_with_a_confirmation(world):
    world.policy(exports=True)
    ch = _export(world).json()
    assert world.call("POST", f"{BASE}/changes/{ch['change_id']}/revert", json={"supervised": True}).json()["code"] == "confirmation_required"
    ok = world.call("POST", f"{BASE}/changes/{ch['change_id']}/revert", json={"confirm": True, "supervised": True})
    assert ok.status_code == 200 and ok.json()["verified"] is True and [x["id"] for x in world.fake.exports] == ["cam_front_foreign"]
    again = world.call("POST", f"{BASE}/changes/{ch['change_id']}/revert", json={"confirm": True, "supervised": True})
    assert again.json()["code"] == "frigate_change_not_reversible"
    r2 = _export(world, name="Another").json()
    world.fake.exports[:] = [x for x in world.fake.exports if x["id"] != r2["export_id"]]   # somebody deleted it in Frigate
    assert world.call("POST", f"{BASE}/changes/{r2['change_id']}/revert", json={"confirm": True}).json()["code"] == "frigate_change_stale"
    r3 = _export(world, name="Third").json()
    rn = world.call("PATCH", f"{BASE}/exports/{r3['export_id']}", json={"name": "Renamed", "supervised": True}).json()
    assert world.call("POST", f"{BASE}/changes/{rn['change_id']}/revert", json={}).status_code == 200
    assert next(x for x in world.fake.exports if x["id"] == r3["export_id"])["name"] == "Third"


# ---------------------------------------------------------------------------------------------- cases

def test_a_case_is_created_listed_renamed_deleted_and_its_creation_undone(world):
    world.policy(cases=True)
    r = world.call("POST", f"{BASE}/cases", json={"name": "Break-in", "description": "Oct 5", "supervised": True}).json()
    cid = r["case_id"]
    assert r["verified"] is True and world.fake.writes[-1] == ("POST", "/api/cases", {"name": "Break-in", "description": "Oct 5"})
    rows = {x["id"]: x for x in world.call("GET", f"{BASE}/cases").json()["cases"]}
    assert rows[cid]["arx_created"] is True and rows["case_foreign"]["arx_created"] is False
    assert world.call("PATCH", f"{BASE}/cases/{cid}", json={"name": "Renamed", "supervised": True}).json()["verified"] is True
    assert world.call("POST", f"{BASE}/cases/{cid}/delete", json={"supervised": True}).json()["code"] == "confirmation_required"
    assert world.call("POST", f"{BASE}/cases/{cid}/delete", json={"confirm": True, "supervised": True}).json()["deleted"] is True
    assert [c["id"] for c in world.fake.cases] == ["case_foreign"]
    assert [c["kind"] for c in world.changes()[:3]] == ["case_delete", "case_rename", "case_create"] and all(c["class"] == "cases" for c in world.changes()[:3])
    world.fake.case_reply_id = False
    r2 = world.call("POST", f"{BASE}/cases", json={"name": "Second", "supervised": True}).json()
    assert r2["case_id"] and r2["verified"] is True, "found by name when the answer has no id"
    undo = world.call("POST", f"{BASE}/changes/{r2['change_id']}/revert", json={"confirm": True, "supervised": True})
    assert undo.status_code == 200 and [c["id"] for c in world.fake.cases] == ["case_foreign"]
    assert world.call("POST", f"{BASE}/cases", json={"name": "", "supervised": True}).status_code == 422


# ---------------------------------------------------------------------------------------------- manual events

def test_a_manual_event_is_created_on_one_camera_read_back_ended_and_only_arx_events_can_be_ended(world):
    world.policy(events=True)
    cid = world.cams()["cam_front"]
    r = world.call("POST", f"{BASE}/cameras/{cid}/events/manual", json={"label": "person", "duration_s": None, "sub_label": "courier", "supervised": True})
    assert r.status_code == 200, r.text
    d = r.json()
    eid = d["event_id"]
    assert d["verified"] is True and d["open"] is True
    assert world.fake.writes[-1] == ("POST", "/api/events/cam_front/person/create", {"sub_label": "courier", "duration": None, "include_recording": True, "score": 0, "draw": {}})
    assert world.fake.event_state[eid]["end_time"] is None
    foreign = world.fake.reviews[2]["data"]["detections"][0]
    assert world.call("POST", f"{BASE}/events/{foreign}/end", json={"supervised": True}).json()["code"] == "frigate_object_not_arx"
    assert world.call("POST", f"{BASE}/events/not-an-id/end", json={"supervised": True}).status_code == 422
    end = world.call("POST", f"{BASE}/events/{eid}/end", json={"supervised": True}).json()
    assert end["ended"] is True and end["verified"] is True and world.fake.event_state[eid]["end_time"] is not None
    assert world.call("POST", f"{BASE}/events/{eid}/end", json={}).json()["ended"] is False, "already ended: nothing written"
    assert [c["kind"] for c in world.changes()[:2]] == ["event_end", "event_create"] and world.changes()[0]["reversible"] is False
    assert world.audit("frigate.control.events")[-1]["decision"] == "allowed"
    for body in ({"label": "per son"}, {"label": ""}, {"label": "person", "duration_s": 0}, {"label": "person", "duration_s": 601}):
        assert world.call("POST", f"{BASE}/cameras/{cid}/events/manual", json={**body, "supervised": True}).status_code == 422, body


def test_a_manual_event_with_a_duration_and_its_undo_that_ends_it(world):
    world.policy(events=True)
    world.fake.event_reply_id = True
    cid = world.cams()["cam_yard"]
    d = world.call("POST", f"{BASE}/cameras/{cid}/events/manual", json={"label": "vehicle", "duration_s": 20, "supervised": True}).json()
    assert d["open"] is False and world.fake.event_state[d["event_id"]]["camera"] == "cam_yard"
    d2 = world.call("POST", f"{BASE}/cameras/{cid}/events/manual", json={"label": "vehicle", "duration_s": None}).json()
    assert d2["verified"] is True, "the second one needs no supervision"
    undo = world.call("POST", f"{BASE}/changes/{d2['change_id']}/revert", json={"supervised": True})
    assert undo.status_code == 200 and world.fake.event_state[d2["event_id"]]["end_time"] is not None
    world.fake.event_reply_id = False
    d3 = world.call("POST", f"{BASE}/cameras/{cid}/events/manual", json={"label": "vehicle", "duration_s": 5}).json()
    assert d3["event_id"] is None and d3["verified"] is False
    assert world.changes()[0]["status"] == "unverified" and world.changes()[0]["reversible"] is False


def test_a_disabled_camera_and_an_out_of_scope_camera_get_no_manual_event(world):
    world.policy(events=True)
    cams = world.cams()
    bind(world.c, world.s, "tal", "system_admin", "camera", cams["cam_front"])
    assert world.call("POST", f"{BASE}/cameras/{cams['cam_yard']}/events/manual", json={"label": "person", "supervised": True}, headers=as_user("tal")).status_code == 403
    with world.app.state.db.connection() as conn:
        conn.execute("UPDATE cameras SET enabled = 0 WHERE id = ?", (cams["cam_garage"],))
    r = world.call("POST", f"{BASE}/cameras/{cams['cam_garage']}/events/manual", json={"label": "person", "supervised": True})
    assert r.status_code == 409 and r.json()["code"] == "camera_disabled"
    assert world.fake.writes == []


# ---------------------------------------------------------------------------------------------- automatic profile on an alarm change

def _map(w: World, **rules):
    r = w.call("PUT", f"{BASE}/profile-rules", json={"rules": rules})
    assert r.status_code == 200, r.text


def test_the_automatic_profile_is_off_by_default_and_queues_nothing(world):
    _map(world, armed_away="away")
    _alarm(world, "disarmed", "armed_away")
    assert _items(world) == [] and _tick(world) == [] and world.fake.writes == []
    s = _auto(world, mode="suggest")
    assert s["mode"] == "suggest" and s["will_apply"] is False
    _auto(world, mode="off")
    _alarm(world, "armed_away", "disarmed")
    assert _items(world) == []


def test_apply_mode_needs_the_explicit_consent_and_withdrawing_it_drops_the_mode(world):
    r = world.call("PUT", f"{BASE}/profile-auto/setting", json={"mode": "apply"})
    assert r.status_code == 422 and r.json()["code"] == "frigate_auto_consent_required"
    assert world.call("PUT", f"{BASE}/profile-auto/setting", json={"mode": "banana"}).json()["code"] == "frigate_auto_mode_invalid"
    s = _auto(world, mode="apply", auto_apply_consent=True)
    assert s["mode"] == "apply" and s["auto_apply_consent"] is True and s["consent_by"] and s["will_apply"] is False, "class off and no supervised write yet"
    assert _auto(world, auto_apply_consent=False)["mode"] == "suggest"
    assert world.audit("frigate.control.profile_auto_setting")[-1]["decision"] == "allowed"


def test_suggest_mode_records_a_suggestion_the_operator_applies_with_a_confirmation(world):
    world.policy(profile=True)
    _map(world, armed_away="away", disarmed="home")
    _auto(world, mode="suggest")
    _alarm(world, "disarmed", "armed_away")
    assert [i["status"] for i in _items(world)] == ["pending"]
    done = _tick(world)
    assert [d["status"] for d in done] == ["suggested"] and world.fake.writes == [] and world.fake.active_profile is None
    item = _items(world)[0]
    assert item["status"] == "suggested" and item["profile"] == "away" and item["alarm_state"] == "armed_away"
    _alarm(world, "armed_away", "armed_night")   # no rule for it: the open suggestion is superseded and nothing new is queued
    assert [i["status"] for i in _items(world)] == ["superseded"]
    _alarm(world, "armed_night", "disarmed")
    new = _items(world)[0]
    _tick(world)
    assert world.call("POST", f"{BASE}/profile-auto/{item['id']}/apply", json={"confirm": True}).json()["code"] == "frigate_auto_not_open"
    assert world.call("POST", f"{BASE}/profile-auto/{new['id']}/apply", json={}).json()["code"] == "confirmation_required"
    ok = world.call("POST", f"{BASE}/profile-auto/{new['id']}/apply", json={"confirm": True}).json()
    assert ok["status"] == "applied" and ok["verified"] is True and world.fake.active_profile == "home"
    assert [i["status"] for i in _items(world)][0] == "applied" and _items(world)[0]["change_id"] == ok["change_id"]
    assert world.call("GET", f"{BASE}/control/first-writes").json()["done"]["profile_auto"] is False, "an unsupervised manual apply is not the supervised first write"


def test_a_suggestion_can_be_dismissed_and_a_stale_one_expires(world):
    world.policy(profile=True)
    _map(world, armed_away="away")
    _auto(world, mode="suggest")
    _alarm(world, "disarmed", "armed_away")
    _tick(world)
    item = _items(world)[0]
    assert world.call("POST", f"{BASE}/profile-auto/{item['id']}/dismiss").json()["status"] == "dismissed"
    assert world.call("POST", f"{BASE}/profile-auto/{item['id']}/dismiss").json()["code"] == "frigate_auto_not_open"
    _alarm(world, "armed_away", "disarmed")
    _map(world, disarmed="home")
    _alarm(world, "disarmed", "armed_away")
    done = _tick(world, now=time.time() + auto.MAX_AGE_S + 5)
    assert [d["status"] for d in done] == ["expired"] and world.fake.writes == []


def test_apply_mode_switches_the_profile_by_itself_only_with_class_consent_and_a_supervised_first_write(world):
    _map(world, armed_away="away", disarmed="home")
    _auto(world, mode="apply", auto_apply_consent=True)
    _alarm(world, "disarmed", "armed_away")
    d = _tick(world)[0]
    assert d["status"] == "suggested" and d["reason"] == "class_off" and world.fake.writes == []
    world.policy(profile=True)
    _alarm(world, "armed_away", "disarmed")
    d = _tick(world)[0]
    assert d["status"] == "suggested" and d["reason"] == "first_write_unsupervised" and world.fake.writes == []
    assert world.audit("frigate.control.profile")[-1]["reason"] == "first_write_unsupervised"
    item = _items(world)[0]
    sup = world.call("POST", f"{BASE}/profile-auto/{item['id']}/apply", json={"confirm": True, "supervised": True}).json()
    assert sup["status"] == "applied" and world.fake.active_profile == "home"
    assert world.call("GET", f"{BASE}/control/first-writes").json()["done"]["profile_auto"] is True
    assert world.call("GET", f"{BASE}/profile-auto").json()["setting"]["will_apply"] is True
    n = len(world.fake.writes)
    _alarm(world, "disarmed", "armed_away")
    d = _tick(world)[0]
    assert d["status"] == "applied" and world.fake.active_profile == "away" and len(world.fake.writes) == n + 1
    assert world.fake.writes[-1] == ("PUT", "/api/camera/*/set/profile", {"value": "away"})
    ch = world.changes()[0]
    assert ch["class"] == "profile" and ch["actor"] == "arx-auto" and ch["status"] == "applied" and ch["before"]["auto"]["alarm_state"] == "armed_away"
    audit_row = world.audit("frigate.control.profile")[-1]
    assert audit_row["decision"] == "allowed" and audit_row["actor_username"] == "arx-auto"
    undo = world.call("POST", f"{BASE}/changes/{ch['id']}/revert", json={"confirm": True})
    assert undo.status_code == 200 and world.fake.active_profile == "home", "an automatic switch is undone like a manual one"
    _alarm(world, "armed_away", "disarmed")   # already home: nothing to write
    n = len(world.fake.writes)
    assert _tick(world)[0]["status"] == "skipped" and len(world.fake.writes) == n


def test_an_automatic_switch_that_fails_is_final_for_its_row_and_never_retried(world):
    world.policy(profile=True)
    _map(world, armed_away="away")
    _auto(world, mode="apply", auto_apply_consent=True)
    with world.app.state.db.connection() as conn:
        native.mark_first_write(conn, type("P", (), {"user_id": "x"})(), "nvr-1", "profile_auto")
    _alarm(world, "disarmed", "armed_away")
    world.fake.write_status = 500
    d = _tick(world)[0]
    assert d["status"] == "failed" and d["reason"] == "source_unavailable"
    assert len([h for h in world.fake.hits if h == "PUT /api/camera/*/set/profile"]) == 1
    assert _tick(world) == [] and len([h for h in world.fake.hits if h == "PUT /api/camera/*/set/profile"]) == 1
    assert world.changes()[0]["status"] == "failed" and world.fake.active_profile is None


def test_switching_the_mode_off_closes_what_is_open_and_the_hook_ignores_other_changes(world):
    _map(world, armed_away="away")
    _auto(world, mode="suggest")
    _alarm(world, "disarmed", "armed_away")
    assert [i["status"] for i in _items(world)] == ["pending"]
    _auto(world, mode="off")
    assert [i["status"] for i in _items(world)] == ["dismissed"]
    _auto(world, mode="suggest")
    ha_sync.handle_state_event(world.app.state.db, {"old_state": {"entity_id": "light.x", "state": "off", "attributes": {}}, "new_state": {"entity_id": "light.x", "state": "on", "attributes": {}}})
    _alarm(world, "armed_away", "armed_away")
    _alarm(world, "armed_away", "unavailable")
    assert [i["status"] for i in _items(world)] == ["dismissed"]
    assert world.call("PUT", f"{BASE}/profile-auto/setting", json={"mode": "suggest"}).status_code == 200
    ha_sync.handle_state_event(world.app.state.db, {"old_state": None, "new_state": {"entity_id": "alarm_control_panel.home", "state": "armed_away", "attributes": {}}})
    assert [i["status"] for i in _items(world)] == ["dismissed"], "a first state is a start-up, not a change"


def test_a_rule_mapped_to_none_switches_the_profile_off(world):
    world.policy(profile=True)
    world.call("PUT", f"{BASE}/profile", json={"profile": "away", "confirm": True})
    _map(world, disarmed="none")
    _auto(world, mode="suggest")
    _alarm(world, "armed_away", "disarmed")
    _tick(world)
    item = _items(world)[0]
    r = world.call("POST", f"{BASE}/profile-auto/{item['id']}/apply", json={"confirm": True}).json()
    assert r["status"] == "applied" and world.fake.active_profile is None and world.fake.writes[-1] == ("PUT", "/api/camera/*/set/profile", {"value": "none"})


# ---------------------------------------------------------------------------------------------- secrets and the migration

def test_the_new_tables_exist_and_the_policy_table_kept_its_rows_shape(world):
    with world.app.state.db.connection(mode="read") as conn:
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()}
        assert {"frigate_profile_auto_setting", "frigate_profile_auto", "frigate_first_write", "frigate_native_objects", "frigate_write_policy"} <= tables
    world.policy(exports=True, cases=True, analytics=True)
    with world.app.state.db.connection(mode="read") as conn:
        assert {c: v for c, v in svc.policy(conn, "nvr-1").items() if v} == {"analytics": True, "exports": True, "cases": True}


# ---------------------------------------------------------------------------------------------- the clip read (GET only, first read supervised)

def _clip_url(w: World, cam="cam_front", **q):
    params = {"start": T0 - 600, "end": T0 - 300, **q}
    return f"{BASE}/cameras/{w.cams()[cam]}/clip.mp4?" + "&".join(f"{k}={str(v).lower() if isinstance(v, bool) else v}" for k, v in params.items())


def test_the_clip_is_a_gated_streamed_get_whose_first_read_is_supervised(world):
    r = world.call("GET", _clip_url(world))
    assert r.status_code == 409 and r.json()["code"] == "frigate_first_write_unsupervised" and world.fake.clip_hits == []
    bind(world.c, world.s, "tal", "site_admin", "installation", "*")
    assert world.call("GET", _clip_url(world, supervised=True), headers=as_user("tal")).status_code == 403, "supervision needs system.configure"
    assert world.fake.clip_hits == []
    ok = world.c.get(_clip_url(world, supervised=True))
    assert ok.status_code == 200 and ok.content == world.fake.clip and ok.headers["content-type"] == "video/mp4"
    assert ok.headers["cache-control"] == "private, no-store" and ok.headers["x-content-type-options"] == "nosniff"
    blob = " ".join(f"{k}: {v}" for k, v in ok.headers.items())
    for leak in ("frigate.test", "8971", "frigate_token", "192.0.2", "/api/cam_front"):
        assert leak not in blob, leak
    assert world.fake.clip_hits == [f"/api/cam_front/start/{T0 - 600:.3f}/end/{T0 - 300:.3f}/clip.mp4"]
    assert world.fake.non_get == ["POST /api/login"], "a clip is one GET after the login, nothing else"
    again = world.c.get(_clip_url(world))
    assert again.status_code == 200 and again.content == world.fake.clip, "after the first supervised read the flag is no longer asked"
    assert world.call("GET", f"{BASE}/control/first-writes").json()["done"]["clip_read"] is True
    assert world.audit("frigate.clip.read")[-1]["decision"] == "allowed"


def test_the_clip_needs_playback_on_the_camera_a_sane_window_and_a_video_answer(world, monkeypatch):
    cams = world.cams()
    bind(world.c, world.s, "tal", "system_admin", "camera", cams["cam_front"])
    h = as_user("tal")
    assert world.call("GET", _clip_url(world, "cam_yard", supervised=True), headers=h).status_code == 403
    assert world.call("GET", _clip_url(world, end=T0 - 700, supervised=True)).status_code == 422
    assert world.call("GET", _clip_url(world, end=T0 + 4000, start=T0 - 600, supervised=True)).status_code == 422
    assert world.fake.clip_hits == []
    world.fake.clip_ctype = "text/html"
    assert world.call("GET", _clip_url(world, supervised=True)).json()["code"] == "source_invalid"
    world.fake.clip_ctype = "application/octet-stream"
    assert world.c.get(_clip_url(world, supervised=True)).status_code == 200
    world.fake.clip_status = 404
    assert world.call("GET", _clip_url(world)).status_code == 404
    world.fake.clip_status = 500
    assert world.call("GET", _clip_url(world)).json()["code"] == "source_unavailable"
    world.fake.clip_status = 200
    monkeypatch.setattr(fh, "CLIP_MAX_BYTES", 100)
    assert world.call("GET", _clip_url(world)).json()["code"] == "source_too_large"


def test_an_event_clip_follows_the_review_scope_and_the_same_gate(world):
    world.poll()
    ev = world.fake.reviews[2]["data"]["detections"][0]
    url = f"{BASE}/events/{ev}/clip.mp4"
    assert world.call("GET", url).json()["code"] == "frigate_first_write_unsupervised"
    ok = world.c.get(url + "?supervised=true")
    assert ok.status_code == 200 and ok.content == world.fake.clip and world.fake.clip_hits == [f"/api/events/{ev}/clip.mp4"]
    assert world.call("GET", f"{BASE}/events/1791227999.000000-nosuch1/clip.mp4").status_code == 404
    assert world.call("GET", f"{BASE}/events/not-an-id/clip.mp4").status_code == 422


def test_the_clip_paths_are_not_on_the_read_allow_list_and_nothing_else_opens_a_clip(world):
    http = fh.FrigateHttp("nvr-1", world.s, transport=world.fake.transport())
    path = "/api/cam_front/start/1791227400.000/end/1791227700.000/clip.mp4"
    assert not fh.allowed(path) and not fh.control_read_allowed(path) and fh.clip_allowed(path) and fh.clip_allowed("/api/events/1791227999.000000-abcd12/clip.mp4")
    with pytest.raises(fh.ApiError):
        http.get(path)
    for bad in ("/api/cam_front/start/1/end/2/clip.mp4/x", "/api/cam_front/start/1/end/2/index.m3u8", "/api/events/not-an-id/clip.mp4", "/api/config", "/vod/cam_front/start/1/end/2/index.m3u8"):
        with pytest.raises(fh.ApiError) as e:
            http.open_clip(bad)
        assert e.value.code == "frigate_path_not_allowed", bad
    assert world.fake.clip_hits == []
