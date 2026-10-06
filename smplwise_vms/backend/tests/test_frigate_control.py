"""NN5 F2 - Frigate control and actions, end to end on the app against the in-process fake Frigate (`fixtures/fake_frigate.py`; never a
real Frigate): the write classes (all off by default), per-action confirmation, camera switches with read-before / read-after, the
change log with undo, profiles and the alarm-state mapping, the reviewed mirror, event actions, the PTZ plumbing behind its flag, the
write allow-list, permissions and camera scope, and the secrets sweep."""
from __future__ import annotations

import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from smplwise import rbac
from smplwise.services import frigate_control_svc as svc
from smplwise.services.recorders import frigate as fr
from smplwise.services.recorders import frigate_control as fc
from smplwise.services.recorders import frigate_events as fe
from smplwise.services.recorders import frigate_http as fh
from smplwise.services.recorders import frigate_io

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from conftest import as_user, bind  # noqa: E402
from fake_frigate import HOST, PASSWORD, PLANTED_PASSWORD, PLANTED_TOKEN_USER, T0, FakeFrigate, FakeWsConnect, settings_for  # noqa: E402
from test_frigate_api import LEAKS, Listener  # noqa: E402

BASE = "/api/v1/frigate/nvr-1"
R1, R2, R3 = "1791227000.100000-aaa111", "1791227500.200000-bbb222", "1791227900.300000-ccc333"


@pytest.fixture(autouse=True)
def _clean():
    fh.clear_cache()
    fr.clear_cache()
    frigate_io.clear_stills()
    fe.STATES.clear()
    svc.clear_leases()
    yield
    fh.clear_cache()
    fr.clear_cache()
    frigate_io.clear_stills()
    svc.clear_leases()


class World:
    def __init__(self, c, app, fake, s):
        self.c, self.app, self.fake, self.s = c, app, fake, s
        self.bodies: list[str] = []

    def call(self, method, path, **kw):
        r = self.c.request(method, path, **kw)
        self.bodies.append(r.text)
        return r

    def cams(self) -> dict[str, str]:
        with self.app.state.db.connection(mode="read") as conn:
            return {r["source_ref"]: r["id"] for r in conn.execute("SELECT id, source_ref FROM cameras WHERE recorder_id = 'nvr-1'").fetchall()}

    def poll(self, now=T0):
        lst = Listener(self.app.state.db, self.s)
        return fe.poll_reviews(lst, fr.FrigateAdapter("nvr-1", self.s, transport=self.fake.transport()), fe.state_of("nvr-1"), now)

    def policy(self, **classes):
        r = self.call("PUT", f"{BASE}/control/policy", json={"classes": classes})
        assert r.status_code == 200, r.text
        return r.json()["policy"]

    def toggle(self, cam, feature, value, confirm=False, headers=None):
        return self.call("PUT", f"{BASE}/cameras/{self.cams()[cam]}/control/{feature}", json={"value": value, "confirm": confirm}, headers=headers or {})

    def audit(self, action):
        with self.app.state.db.connection(mode="read") as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]

    def changes(self):
        return self.call("GET", f"{BASE}/changes").json()["changes"]

    def puts(self):
        return [h for h in self.fake.hits if h.startswith(("PUT ", "POST /api/reviews", "POST /api/events", "DELETE "))]


@pytest.fixture()
def world(settings, monkeypatch):
    from smplwise.main import create_app

    fake = FakeFrigate()
    monkeypatch.setattr(fr, "TRANSPORT", fake.transport())
    s = settings_for(settings)
    app = create_app(s)
    with TestClient(app) as c:
        w = World(c, app, fake, s)
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline and len(w.cams()) < 3:
            time.sleep(0.05)
        assert len(w.cams()) == 3
        yield w
        for body in w.bodies:
            for leak in LEAKS:
                assert leak not in body, f"{leak!r} leaked into an API body"


# ---------------------------------------------------------------------------------------------- defaults and the allow-list

def test_every_write_class_is_off_by_default_and_nothing_is_written(world):
    pol = world.call("GET", f"{BASE}/control/policy").json()
    assert {c["class"]: c["enabled"] for c in pol["classes"]} == {c: False for c in svc.CLASSES} and pol["ptz_released"] is False
    assert {c["class"]: c["per_action"] for c in pol["classes"]} == {"analytics": False, "record": True, "profile": True, "review": False, "events": False, "ptz": True}
    r = world.toggle("cam_front", "detect", False)
    assert r.status_code == 409 and r.json()["code"] == "frigate_write_class_off"
    assert world.call("PUT", f"{BASE}/profile", json={"profile": "away", "confirm": True}).json()["code"] == "frigate_write_class_off"
    assert world.fake.non_get == ["POST /api/login"] and world.fake.writes == []
    assert world.audit("frigate.control.analytics")[0]["decision"] == "denied"


def test_the_write_allow_list_is_separate_from_the_read_allow_list(world):
    http = fh.FrigateHttp("nvr-1", world.s, transport=world.fake.transport())
    for klass, method, path in [("analytics", "PUT", "/api/config/set"), ("analytics", "POST", "/api/restart"), ("events", "DELETE", "/api/events/1791227001.000000-detaaa"),
                                ("analytics", "PUT", "/api/camera/*/set/detect"), ("record", "PUT", "/api/camera/cam_front/set/detect"), ("analytics", "PUT", "/api/camera/cam_front/set/enabled"),
                                ("profile", "PUT", "/api/camera/cam_front/set/profile"), ("analytics", "DELETE", "/api/camera/cam_front/set/detect"), ("review", "POST", "/api/reviews/delete"),
                                ("analytics", "PUT", "/api/users/x/role"), ("events", "POST", "/api/events/1791227001.000000-detaaa/attributes"), ("nonsense", "PUT", "/api/camera/cam_front/set/detect")]:
        with pytest.raises(fh.ApiError) as e:
            http.write(klass, method, path, {"value": "ON"})
        assert e.value.code == "frigate_path_not_allowed", (klass, method, path)
    assert not fh.allowed("/api/camera/cam_front/set/detect"), "a write path is not a readable path"
    assert not fh.allowed("/api/cam_front/ptz/info") and fh.control_read_allowed("/api/cam_front/ptz/info"), "PTZ facts are readable only through the control path"
    with pytest.raises(fh.ApiError):
        http.get("/api/cam_front/ptz/info")
    with pytest.raises(fh.ApiError):
        http.get("/api/camera/cam_front/set/detect")
    assert world.fake.writes == [] and not [h for h in world.fake.hits if h.startswith("PUT ")]


# ---------------------------------------------------------------------------------------------- camera switches

def test_the_control_view_reports_state_and_what_the_caller_may_change(world):
    cid = world.cams()["cam_front"]
    d = world.call("GET", f"{BASE}/cameras/{cid}/control").json()
    feats = {f["feature"]: f["value"] for f in d["features"]}
    assert feats["detect"] is True and feats["audio"] is False and feats["notifications"] is False and feats["enabled"] is True and feats["recordings"] is True
    assert d["writable"] == {"analytics": False, "record": False, "ptz": False}
    world.policy(analytics=True)
    assert world.call("GET", f"{BASE}/cameras/{cid}/control").json()["writable"] == {"analytics": True, "record": False, "ptz": False}


def test_an_analytics_toggle_is_read_before_written_once_read_back_and_logged(world):
    world.policy(analytics=True)
    r = world.toggle("cam_front", "detect", False)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["changed"] is True and d["verified"] is True and d["value"] is False and d["feature"] == "detect"
    assert world.fake.cameras["cam_front"]["detect"]["enabled"] is False and world.fake.cameras["cam_yard"]["detect"]["enabled"] is True, "one camera only"
    assert world.fake.writes == [("PUT", "/api/camera/cam_front/set/detect", {"value": "OFF"})]
    [ch] = world.changes()
    assert (ch["class"], ch["kind"], ch["target"], ch["status"], ch["camera_key"]) == ("analytics", "feature", "detect", "applied", "cam_front")
    assert ch["before"] == {"value": True} and ch["after"] == {"value": False} and ch["reversible"] is True and ch["id"] == d["change_id"]
    assert world.audit("frigate.control.analytics")[-1]["decision"] == "allowed"
    again = world.toggle("cam_front", "detect", False).json()
    assert again["changed"] is False and len(world.fake.writes) == 1 and len(world.changes()) == 1, "already off: no write, no log row"


def test_unknown_features_and_all_cameras_are_refused(world):
    world.policy(analytics=True, record=True)
    cid = world.cams()["cam_front"]
    for feat in ("config", "restart", "profile", "*", "detect/extra"):
        r = world.call("PUT", f"{BASE}/cameras/{cid}/control/{feat}", json={"value": True})
        assert r.status_code in (404, 422), (feat, r.status_code)
    assert world.call("PUT", f"{BASE}/cameras/*/control/detect", json={"value": True}).status_code in (403, 404, 422)
    assert world.call("PUT", f"{BASE}/cameras/{cid}/control/detect", json={"value": True, "evil": 1}).status_code == 422
    assert world.fake.writes == []


def test_recording_switches_need_the_class_and_a_confirmation_each_time(world):
    world.policy(analytics=True)
    assert world.toggle("cam_front", "recordings", False, confirm=True).json()["code"] == "frigate_write_class_off", "the analytics class does not cover recording"
    world.policy(record=True)
    r = world.toggle("cam_front", "recordings", False)
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required" and world.fake.writes == []
    ok = world.toggle("cam_front", "recordings", False, confirm=True)
    assert ok.status_code == 200 and world.fake.cameras["cam_front"]["record"]["enabled"] is False
    assert world.toggle("cam_front", "recordings", True).json()["code"] == "confirmation_required", "every action, not once per session"
    assert world.changes()[0]["class"] == "record"


def test_a_toggle_whose_state_cannot_be_read_back_is_logged_as_unverified_not_failed(world):
    world.policy(analytics=True)
    world.fake.reflect_runtime = False
    d = world.toggle("cam_front", "audio", True).json()
    assert d["changed"] is True and d["verified"] is False
    [ch] = world.changes()
    assert ch["status"] == "unverified" and ch["reversible"] is True


def test_a_refused_or_lost_write_is_logged_failed_and_never_repeated(world):
    world.policy(analytics=True)
    world.fake.write_role_ok = False
    r = world.toggle("cam_front", "detect", False)
    assert r.status_code == 409 and r.json()["code"] == "frigate_write_forbidden", "a viewer account cannot write: said clearly"
    world.fake.write_role_ok = True
    world.fake.write_status = 500
    r = world.toggle("cam_front", "detect", False)
    assert r.status_code == 503 and r.json()["code"] == "source_unavailable"
    assert len([h for h in world.fake.hits if h == "PUT /api/camera/cam_front/set/detect"]) == 2, "one attempt per call, no automatic retry"
    assert [c["status"] for c in world.changes()] == ["failed", "failed"] and not any(c["reversible"] for c in world.changes())
    assert world.fake.cameras["cam_front"]["detect"]["enabled"] is True


def test_an_expired_session_is_renewed_once_for_a_write_without_repeating_it(world):
    world.policy(analytics=True)
    world.toggle("cam_front", "detect", True)  # warms the session
    world.fake.expire_after = world.fake.authed_requests + 1
    d = world.toggle("cam_front", "motion", False)
    assert d.status_code == 200, d.text
    assert [w for w in world.fake.writes if w[1].endswith("/motion")] == [("PUT", "/api/camera/cam_front/set/motion", {"value": "OFF"})], "applied exactly once"


# ---------------------------------------------------------------------------------------------- undo

def test_a_change_is_undone_from_the_log_and_a_stale_or_repeated_undo_is_refused(world):
    world.policy(analytics=True)
    cid = world.toggle("cam_front", "detect", False).json()["change_id"]
    r = world.call("POST", f"{BASE}/changes/{cid}/revert", json={})
    assert r.status_code == 200 and r.json()["reverted"] is True and r.json()["verified"] is True
    assert world.fake.cameras["cam_front"]["detect"]["enabled"] is True
    log = world.changes()
    assert {c["id"]: c["status"] for c in log}[cid] == "reverted" and log[0]["reverts_id"] == cid and log[0]["reversible"] is False
    assert world.call("POST", f"{BASE}/changes/{cid}/revert", json={}).json()["code"] == "frigate_change_not_reversible"
    c2 = world.toggle("cam_front", "detect", False).json()["change_id"]
    world.fake.cameras["cam_front"]["detect"]["enabled"] = True  # somebody switched it back in Frigate itself
    stale = world.call("POST", f"{BASE}/changes/{c2}/revert", json={})
    assert stale.status_code == 409 and stale.json()["code"] == "frigate_change_stale"
    assert world.call("POST", f"{BASE}/changes/nope/revert", json={}).status_code == 404


def test_undoing_a_recording_change_needs_the_confirmation_again(world):
    world.policy(record=True)
    cid = world.toggle("cam_front", "snapshots", True, confirm=True).json()["change_id"]
    assert world.call("POST", f"{BASE}/changes/{cid}/revert", json={}).json()["code"] == "confirmation_required"
    assert world.call("POST", f"{BASE}/changes/{cid}/revert", json={"confirm": True}).status_code == 200
    assert world.fake.cameras["cam_front"]["snapshots"]["enabled"] is False


# ---------------------------------------------------------------------------------------------- permissions and scope

def test_policy_is_for_the_administrator_and_the_class_permissions_are_checked(world):
    bind(world.c, world.s, "lena", "operator", "installation", "*")
    h = as_user("lena")
    assert world.call("PUT", f"{BASE}/control/policy", json={"classes": {"analytics": True}}, headers=h).status_code == 403
    world.policy(analytics=True, record=True, profile=True, events=True)
    assert world.toggle("cam_front", "detect", False, headers=h).status_code == 403, "an operator has no analytics.control"
    assert world.toggle("cam_front", "recordings", False, confirm=True, headers=h).status_code == 403
    assert world.call("PUT", f"{BASE}/profile", json={"profile": "away", "confirm": True}, headers=h).status_code == 403
    assert world.call("GET", f"{BASE}/changes", headers=h).status_code == 403 and world.call("GET", f"{BASE}/control/policy", headers=h).status_code == 403
    assert world.fake.writes == []


def test_control_is_limited_to_the_cameras_of_the_binding(world):
    cams = world.cams()
    bind(world.c, world.s, "tal", "site_admin", "camera", cams["cam_front"])
    h = as_user("tal")
    world.policy(analytics=True)
    assert world.toggle("cam_front", "detect", False, headers=h).status_code == 200
    assert world.toggle("cam_yard", "detect", False, headers=h).status_code == 403
    assert world.call("PUT", f"{BASE}/cameras/{cams['cam_yard']}/control/detect", json={"value": False}, headers=h).status_code == 403
    assert world.fake.cameras["cam_yard"]["detect"]["enabled"] is True
    mine = world.call("GET", f"{BASE}/changes", headers=h)
    assert mine.status_code == 200 and {c["camera_key"] for c in mine.json()["changes"]} == {"cam_front"}


def test_a_recorder_that_is_not_frigate_is_a_404_for_every_control_route(world):
    r = world.call("PUT", "/api/v1/frigate/nope/control/policy", json={"classes": {"analytics": True}})
    assert r.status_code == 404


# ---------------------------------------------------------------------------------------------- profiles

def test_a_profile_switch_is_per_action_logged_and_undone(world):
    r = world.call("GET", f"{BASE}/profiles").json()
    assert r.get("names") == ["away", "home"], r
    assert r["active"] is None and r["can_switch"] is False
    world.policy(profile=True)
    assert world.call("PUT", f"{BASE}/profile", json={"profile": "away"}).json()["code"] == "confirmation_required"
    assert world.call("PUT", f"{BASE}/profile", json={"profile": "ghost", "confirm": True}).json()["code"] == "frigate_profile_unknown"
    ok = world.call("PUT", f"{BASE}/profile", json={"profile": "away", "confirm": True}).json()
    assert ok["changed"] is True and ok["verified"] is True and ok["active"] == "away" and world.fake.active_profile == "away"
    assert world.fake.writes == [("PUT", "/api/camera/*/set/profile", {"value": "away"})]
    assert world.call("GET", f"{BASE}/profiles").json()["active"] == "away"
    assert world.call("PUT", f"{BASE}/profile", json={"profile": "away", "confirm": True}).json()["changed"] is False
    undo = world.call("POST", f"{BASE}/changes/{ok['change_id']}/revert", json={"confirm": True})
    assert undo.status_code == 200 and world.fake.active_profile is None
    assert world.call("PUT", f"{BASE}/profile", json={"profile": "bad name!", "confirm": True}).status_code in (409, 422)


def test_the_alarm_state_mapping_suggests_a_profile_and_never_switches_one(world):
    assert world.call("GET", f"{BASE}/profile-suggestion?alarm_state=armed_away").json()["profile"] is None
    r = world.call("PUT", f"{BASE}/profile-rules", json={"rules": {"armed_away": "away", "disarmed": "home"}})
    assert r.status_code == 200 and r.json()["rules"] == {"armed_away": "away", "disarmed": "home"}
    assert world.call("GET", f"{BASE}/profile-suggestion?alarm_state=armed_away").json()["profile"] == "away"
    assert world.call("PUT", f"{BASE}/profile-rules", json={"rules": {"armed_away": None}}).json()["rules"] == {"disarmed": "home"}
    assert world.call("PUT", f"{BASE}/profile-rules", json={"rules": {"made_up": "away"}}).json()["code"] == "frigate_alarm_state_unknown"
    assert world.call("PUT", f"{BASE}/profile-rules", json={"rules": {"disarmed": "bad name!"}}).json()["code"] == "frigate_profile_invalid"
    assert world.fake.writes == [] and world.fake.active_profile is None
    bind(world.c, world.s, "lena", "operator", "installation", "*")
    assert world.call("PUT", f"{BASE}/profile-rules", json={"rules": {"disarmed": "home"}}, headers=as_user("lena")).status_code == 403


# ---------------------------------------------------------------------------------------------- reviewed mirror

def test_reviewed_stays_arx_only_until_the_review_class_is_on_then_mirrors_to_frigate(world):
    world.poll()
    r = world.call("POST", f"{BASE}/reviews/reviewed", json={"ids": [R1]}).json()
    assert r["mirror"] == {"state": "off", "count": 0} and world.fake.writes == []
    world.policy(review=True)
    r = world.call("POST", f"{BASE}/reviews/reviewed", json={"ids": [R1, R2]}).json()
    assert r["mirror"] == {"state": "done", "count": 2} and r["count"] == 2
    assert world.fake.writes == [("POST", "/api/reviews/viewed", {"ids": [R1, R2]})]
    assert [x["has_been_reviewed"] for x in world.fake.reviews[:2]] == [True, True]
    with world.app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT mirrored_at, mirror_error FROM frigate_review_state WHERE review_id = ? AND recorder_id = 'nvr-1' AND user_id != ''", (R2,)).fetchone()
    assert row["mirrored_at"] and row["mirror_error"] is None
    assert world.audit("frigate.control.review")[-1]["decision"] == "allowed"


def test_the_mirror_needs_analytics_review_and_a_failed_mirror_never_undoes_arx(world, monkeypatch):
    world.poll()
    world.policy(review=True)
    monkeypatch.setitem(rbac.ROLES, "operator", [p for p in rbac.ROLES["operator"] if p != "analytics.review"])
    bind(world.c, world.s, "lena", "operator", "installation", "*")
    r = world.call("POST", f"{BASE}/reviews/reviewed", json={"ids": [R1]}, headers=as_user("lena")).json()
    assert r["mirror"]["state"] == "not_permitted" and r["count"] == 1 and world.fake.writes == []
    world.fake.write_status = 500
    r = world.call("POST", f"{BASE}/reviews/reviewed", json={"ids": [R2]})
    body = r.json()
    assert r.status_code == 200 and body["count"] == 1 and body["mirror"] == {"state": "failed", "count": 0, "code": "source_unavailable"}
    mine = world.call("GET", f"{BASE}/reviews?reviewed=true").json()["items"]
    assert [i["id"] for i in mine] == [R2], "Arx's own state was written although the mirror failed"
    with world.app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT mirror_error FROM frigate_review_state WHERE review_id = ?", (R2,)).fetchone()[0] == "source_unavailable"


def test_an_unmark_reaches_frigate_only_when_no_other_user_still_holds_it(world):
    world.poll()
    world.policy(review=True)
    bind(world.c, world.s, "lena", "operator", "installation", "*")
    h = as_user("lena")
    world.call("POST", f"{BASE}/reviews/reviewed", json={"ids": [R1]})
    world.call("POST", f"{BASE}/reviews/reviewed", json={"ids": [R1]}, headers=h)
    first = world.call("POST", f"{BASE}/reviews/reviewed", json={"ids": [R1], "reviewed": False}).json()
    assert first["mirror"]["count"] == 0 and world.fake.reviews[0]["has_been_reviewed"] is True, "lena still holds it"
    second = world.call("POST", f"{BASE}/reviews/reviewed", json={"ids": [R1], "reviewed": False}, headers=h).json()
    assert second["mirror"] == {"state": "done", "count": 1} and world.fake.reviews[0]["has_been_reviewed"] is False
    assert ("DELETE", f"/api/review/{R1}/viewed", None) in world.fake.writes


# ---------------------------------------------------------------------------------------------- event actions

def _event_id(world) -> str:
    world.poll()
    return world.fake.reviews[0]["data"]["detections"][0]


def test_retain_and_sub_label_are_class_gated_logged_and_undone(world):
    ev = _event_id(world)
    assert world.call("POST", f"{BASE}/events/{ev}/retain", json={"retain": True}).json()["code"] == "frigate_write_class_off"
    world.policy(events=True)
    r = world.call("POST", f"{BASE}/events/{ev}/retain", json={"retain": True}).json()
    assert r["changed"] is True and r["verified"] is True and world.fake.event_state[ev]["retain"] is True
    assert world.call("POST", f"{BASE}/events/{ev}/retain", json={"retain": True}).json()["changed"] is False
    s = world.call("POST", f"{BASE}/events/{ev}/sub-label", json={"sub_label": "Dana"}).json()
    assert s["changed"] is True and s["sub_label"] == "Dana" and world.fake.event_state[ev]["sub_label"] == "Dana"
    assert world.fake.writes == [("POST", f"/api/events/{ev}/retain", None), ("POST", f"/api/events/{ev}/sub_label", {"subLabel": "Dana"})]
    assert world.call("POST", f"{BASE}/changes/{r['change_id']}/revert", json={}).status_code == 200 and world.fake.event_state[ev]["retain"] is False
    assert world.call("POST", f"{BASE}/changes/{s['change_id']}/revert", json={}).status_code == 200 and world.fake.event_state[ev]["sub_label"] is None
    assert world.call("POST", f"{BASE}/events/{ev}/sub-label", json={"sub_label": "x" * 61}).status_code == 422
    assert not [w for w in world.fake.writes if "delete" in w[1].lower()] and not [h for h in world.fake.hits if h.startswith("DELETE /api/events/") and not h.endswith("/retain")]


def test_event_actions_only_reach_events_of_visible_review_items(world):
    ev = _event_id(world)
    world.policy(events=True)
    assert world.call("POST", f"{BASE}/events/1791227001.000000-zzzzzz/retain", json={"retain": True}).status_code == 404
    cams = world.cams()
    bind(world.c, world.s, "tal", "site_admin", "camera", cams["cam_yard"])
    assert world.call("POST", f"{BASE}/events/{ev}/retain", json={"retain": True}, headers=as_user("tal")).status_code == 403, "the event belongs to cam_front"
    assert world.fake.writes == []


def test_event_control_read_shows_the_state_only_to_a_caller_who_may_change_it(world):
    """The review screen's read (F2 gap): writable false and NO Frigate call while the class is off or the camera is not the caller's."""
    ev = _event_id(world)
    URL = f"{BASE}/events/{ev}/control"
    before = len(world.fake.hits)
    off = world.call("GET", URL).json()
    assert off["writable"] is False and "retain" not in off and len(world.fake.hits) == before, "class off: nothing is read from Frigate"
    world.policy(events=True)
    on = world.call("GET", URL).json()
    assert on["writable"] is True and on["retain"] is False and on["sub_label"] is None
    world.call("POST", f"{BASE}/events/{ev}/retain", json={"retain": True})
    world.call("POST", f"{BASE}/events/{ev}/sub-label", json={"sub_label": "Dana"})
    again = world.call("GET", URL).json()
    assert again["retain"] is True and again["sub_label"] == "Dana"
    cams = world.cams()
    bind(world.c, world.s, "tal", "site_admin", "camera", cams["cam_yard"])
    assert world.call("GET", URL, headers=as_user("tal")).status_code == 403, "the event belongs to cam_front"
    bind(world.c, world.s, "vera", "viewer", "installation", "*")
    assert world.call("GET", URL, headers=as_user("vera")).status_code == 403, "a viewer cannot read events at all"
    bind(world.c, world.s, "oren", "operator", "installation", "*")
    hits = len(world.fake.hits)
    ro = world.call("GET", URL, headers=as_user("oren"))
    assert ro.status_code == 200 and ro.json()["writable"] is False and "retain" not in ro.json() and len(world.fake.hits) == hits, "an operator reads events but holds no analytics.events: no Frigate call"
    assert world.call("GET", f"{BASE}/events/1791227001.000000-zzzzzz/control").status_code == 404
    assert [w for w in world.fake.writes if w[1].endswith("/control")] == []


# ---------------------------------------------------------------------------------------------- PTZ plumbing behind its flag

def test_ptz_is_disabled_by_the_flag_whatever_the_policy_and_permission(world, monkeypatch):
    monkeypatch.setitem(rbac.ROLES, "site_admin", rbac.ROLES["site_admin"] + ["camera.ptz"])
    monkeypatch.setitem(rbac.ROLES, "system_admin", rbac.ROLES["system_admin"] + ["camera.ptz"])
    r = world.call("PUT", f"{BASE}/control/policy", json={"classes": {"ptz": True}})
    assert r.status_code == 409 and r.json()["code"] == "frigate_ptz_not_released"
    ws = FakeWsConnect()
    monkeypatch.setattr(fc, "WS_CONNECT", ws)
    cid = world.cams()["cam_front"]
    r = world.call("POST", f"{BASE}/cameras/{cid}/ptz", json={"command": "move_left", "confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "frigate_ptz_disabled"
    assert ws.calls == [] and ws.sent == [] and world.audit("frigate.control.ptz")[-1]["reason"] == "not_released"
    st = world.call("GET", f"{BASE}/cameras/{cid}/ptz").json()
    assert st["released"] is False and st["enabled"] is False and st["available"] is True and st["presets"] == ["door", "gate"]


def test_ptz_without_the_permission_is_refused_before_anything_else(world):
    cid = world.cams()["cam_front"]
    r = world.call("POST", f"{BASE}/cameras/{cid}/ptz", json={"command": "STOP", "confirm": True})
    assert r.status_code == 403, "no built-in role holds camera.ptz"


def test_the_ptz_plumbing_sends_one_step_with_a_lease_and_never_retries(world, monkeypatch):
    monkeypatch.setattr(svc, "PTZ_RELEASED", True)
    for role in ("site_admin", "system_admin"):
        monkeypatch.setitem(rbac.ROLES, role, rbac.ROLES[role] + ["camera.ptz"])
    ws = FakeWsConnect()
    monkeypatch.setattr(fc, "WS_CONNECT", ws)
    world.policy(ptz=True)
    cid = world.cams()["cam_front"]
    url = f"{BASE}/cameras/{cid}/ptz"
    assert world.call("POST", url, json={"command": "MOVE_LEFT"}).json()["code"] == "confirmation_required" and ws.sent == []
    for bad in ("patrol", "autotrack_start", "MOVE_LEFT; rm", "preset_", "../x"):
        assert world.call("POST", url, json={"command": bad, "confirm": True}).status_code == 422, bad
    ok = world.call("POST", url, json={"command": "move_left", "confirm": True})
    assert ok.status_code == 200 and ok.json()["sent"] is True and ok.json()["command"] == "MOVE_LEFT"
    assert ws.sent == [{"topic": "cam_front/ptz", "payload": "MOVE_LEFT"}] and ws.calls[0].startswith("ws")
    assert world.call("POST", url, json={"command": "preset_door", "confirm": True}).status_code == 200
    assert ws.sent[-1]["payload"] == "preset_door"
    ch = [c for c in world.changes() if c["class"] == "ptz"]
    assert len(ch) == 2 and not any(c["reversible"] for c in ch), "a physical step is logged but cannot be undone"
    # a second person is refused while the first holds the lease
    bind(world.c, world.s, "tal", "site_admin", "installation", "*")
    other = world.call("POST", url, json={"command": "STOP", "confirm": True}, headers=as_user("tal"))
    assert other.status_code == 409 and other.json()["code"] == "ptz_leased" and len(ws.sent) == 2
    # a lost connection is reported once and never repeated
    ws.fail = True
    n = len(ws.calls)
    lost = world.call("POST", url, json={"command": "ZOOM_IN", "confirm": True})
    assert lost.status_code == 503 and lost.json()["code"] == "frigate_write_unknown" and len(ws.sent) == 2 and ws.calls == ws.calls[:n]
    assert world.changes()[0]["status"] == "failed"


def test_normalize_ptz_allows_single_steps_only():
    assert fc.normalize_ptz("zoom_out") == "ZOOM_OUT" and fc.normalize_ptz("preset_gate-1") == "preset_gate-1"
    for bad in ("", "patrol", "preset_", "MOVE_UP MOVE_UP", "preset_a b"):
        with pytest.raises(fh.ApiError):
            fc.normalize_ptz(bad)


# ---------------------------------------------------------------------------------------------- the whole run leaves F1's promise intact

def test_only_the_calls_of_the_classes_that_were_used_reached_frigate(world):
    world.poll()
    world.policy(analytics=True)
    world.toggle("cam_front", "detect", False)
    world.call("POST", f"{BASE}/reviews/reviewed", json={"ids": [R1]})
    methods = sorted({n.split(" ")[0] + " " + n.split(" ")[1].split("/")[2] for n in world.fake.non_get} - {"POST login"})
    assert world.fake.non_get == ["POST /api/login", "PUT /api/camera/cam_front/set/detect"], "the review class is off: its mirror sent nothing"
    assert methods == ["PUT camera"]
