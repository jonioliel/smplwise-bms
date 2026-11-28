"""MFA-STEPUP-GATES-2490 (slice 3 of the step-up train, docs/changes/MFA-STEPUP-GATES-2490.md): the physical-safety gates, the
once-actions on the central proof, the gaps of slice 1 closed, and the route-table ratchet.

Covered: alarm disarm / zone bypass / bypass arming need a fresh proof (owner Q45), arming and restoring a zone never do, nothing is
sent or recorded before the proof, the alarm-PIN fallback for one alarm action; every door opening (the one door path, the bridge
unlock, a run that opens doors, the hold-open button, the acceptance pulse) is gated at its choke point and never outside a request;
the administrator's factor reset, the bridge-key reveal and the passkey removal ask for a proof on EVERY call (inline code as before,
or a once-proof bound to the action - a window proof never counts); a delegated assigner (assigns_anywhere), a handler that opens its
own connection and the door-automation / visitor-entrance / ticket settings granted without require() are gated; the read-only POST
routes are not; and every write route that references a gated permission is gated or listed with a reason (the ratchet)."""
from __future__ import annotations

import json
import time
import types
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from smplwise.errors import ApiError
from smplwise.rbac import INSTALLATION, require
from smplwise.services import rbac_admin
from smplwise.services import second_factor as sf
from smplwise.services import step_up
from test_alarm import BOSS, CODE, PIN, _act, _bypass, _fresh_limits, _no_code, alarm_app  # noqa: F401 - fixtures
from test_mfa_stepup_2490 import OWNER, Clock, clock, details, fake_request, owner_enrolled_and_stale, title, verify  # noqa: F401 - fixtures
from test_second_factor import arx, bump_step, code_now, enrol, fresh_login  # noqa: F401 - `arx` is the fixture

HOUSE = "alarm_control_panel.risco_house"
RESET = "/arx/api/v1/auth/second-factor/users/u-viewer"


# ---------------------------------------------------------------- the registry

def test_the_physical_and_once_registries():
    assert step_up.PHYSICAL_ACTIONS == {"alarm.disarm", "alarm.bypass", "door.open"}
    assert {"alarm.disarm", "alarm.bypass", "door.unlock", "access.doors.open", "access.release"} == step_up.PHYSICAL_PERMISSIONS
    assert not step_up.PHYSICAL_PERMISSIONS & step_up.GATED_PERMISSIONS  # never through require(): each choke point calls guard_action
    assert set(step_up.ONCE_ROUTES.values()) == step_up.ONCE_ACTIONS == {"auth.second_factor.reset", "bridge.key.code_revealed",
                                                                          "auth.local.passkey.removed"}
    assert step_up.EXEMPT_ROUTES == set(step_up.ONCE_ROUTES)
    assert not set(step_up.READ_ONLY_ROUTES) & step_up.EXEMPT_ROUTES
    assert all(reason for reason in step_up.READ_ONLY_ROUTES.values())


# ---------------------------------------------------------------- guard_action (unit)

def test_guard_action_refuses_a_stale_write_and_passes_with_a_proof(arx, clock):
    enrol(arx, arx.owner)
    clock.advance(6)
    req = fake_request(arx, "i:door")
    with arx.db.connection(mode="read") as conn:
        with pytest.raises(ApiError) as e:
            step_up.guard_action(conn, req, OWNER, step_up.ACTION_DOOR_OPEN)
        assert e.value.status == 403 and e.value.code == "step_up_required"
        assert e.value.details["action"] == "door.open" and e.value.details["methods"] == ["totp"] and "דלת" in e.value.user_message
        step_up.mark(conn, req, OWNER, "totp")
        step_up.guard_action(conn, fake_request(arx, "i:door"), OWNER, step_up.ACTION_DOOR_OPEN)  # a fresh request with the proof
    row = arx.audit("auth.step_up.required")[-1]
    assert details(row)["permission"] == "door.open" and row["resource_id"] == "door.open"


def test_guard_action_never_gates_outside_a_write_request(arx, clock):
    enrol(arx, arx.owner)
    clock.advance(6)
    with arx.db.connection(mode="read") as conn:
        step_up.guard_action(conn, None, OWNER, step_up.ACTION_DISARM)  # a timer / an automation firing: no request at all
        step_up.guard_action(conn, fake_request(arx, "i:get", method="GET"), OWNER, step_up.ACTION_DISARM)
        arx.setting("security.step_up", "off")
        step_up.guard_action(conn, fake_request(arx, "i:off"), OWNER, step_up.ACTION_DISARM)
    with pytest.raises(AssertionError):
        step_up.guard_action(None, None, OWNER, "system.configure")  # only the registered physical actions
    assert arx.audit("auth.step_up.required") == []


def test_the_one_door_path_is_gated_before_anything_is_reserved(arx, clock, monkeypatch):
    from smplwise.routers import access_control_door as acd
    from smplwise.services import door_authority

    enrol(arx, arx.owner)
    clock.advance(6)
    reached: list[str] = []
    monkeypatch.setattr(acd.trusted_door, "mode", lambda conn: reached.append("mode") or "off")
    with arx.db.connection() as conn:
        act = types.SimpleNamespace(conn=conn, request=fake_request(arx, "i:tile"), principal=OWNER, details={})
        with pytest.raises(ApiError) as e:
            acd.open_door(act, "st-1", 1, "wiskey_screen", datetime.now(timezone.utc) + timedelta(seconds=20),
                          door_authority.DoorDecision(True, "binding"))
    assert e.value.code == "step_up_required" and e.value.details["action"] == "door.open"
    assert reached == [] and acd.RELAYS.remaining(("st-1", 1)) == 0  # nothing past the gate ran; the relay was never reserved


# ---------------------------------------------------------------- the alarm routes (local channel with security.step_up_local = on)

def _totp(app, s, user_id: str) -> str:
    with app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT * FROM auth_totp WHERE user_id = ?", (user_id,)).fetchone()
    return sf.hotp(sf._secret_of(s, row), sf.step_of())


def _bump(app, user_id: str) -> None:
    with app.state.db.connection() as conn:
        conn.execute("UPDATE auth_totp SET last_step = last_step - 100 WHERE user_id = ?", (user_id,))


@pytest.fixture()
def gated_alarm(alarm_app, monkeypatch, clock):  # noqa: F811 - pytest fixtures by name
    """The developer identity (dev-joni, system administrator) enrolls the authenticator on the local channel; its enrolment proof
    runs out; the local channel is then gated (security.step_up_local = on). Returns (app, settings, client, bridge calls, enable)."""
    app, s, c, calls, _ = alarm_app
    frozen = (int(time.time() // sf.PERIOD_S)) * sf.PERIOD_S + 15
    monkeypatch.setattr(sf, "time", types.SimpleNamespace(time=lambda: float(frozen)))

    def enable() -> None:
        assert c.patch("/api/v1/settings", json={"security.step_up": "on"}).status_code == 200  # MFA-SECFIX-2500: off by default (Q2 = b)
        assert c.post("/api/v1/auth/second-factor/enroll").status_code == 200
        assert c.post("/api/v1/auth/second-factor/confirm", json={"code": _totp(app, s, "dev-joni")}).status_code == 200
        assert c.patch("/api/v1/settings", json={"security.step_up_local": "on"}).status_code == 200  # inside the enrolment's grace
        clock.advance(6)

    return app, s, c, calls, enable


def _local_verify(app, s, c):
    _bump(app, "dev-joni")
    return c.post("/api/v1/auth/step-up/verify", json={"code": _totp(app, s, "dev-joni"), "action": "alarm.disarm"})


def _ha_actions(app) -> int:
    with app.state.db.connection(mode="read") as conn:
        return conn.execute("SELECT COUNT(*) FROM ha_actions").fetchone()[0]


def test_disarm_needs_a_fresh_proof_and_nothing_is_sent_before_it(gated_alarm):
    app, s, c, calls, enable = gated_alarm
    assert c.put(f"/api/v1/alarm/panels/{HOUSE}/code", json={"code": CODE}).status_code == 200  # the panel's code is sent for a no-code user
    _no_code(c)
    enable()
    n, rows = len(calls), _ha_actions(app)
    r = _act(c, HOUSE, "disarm", confirmed=True)
    assert r.status_code == 403 and r.json()["code"] == "step_up_required", r.text
    assert r.json()["details"]["action"] == "alarm.disarm" and "אזעקה" in r.json()["user_message"]
    assert len(calls) == n and _ha_actions(app) == rows  # nothing sent, nothing recorded
    with app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT * FROM audit_log WHERE action = 'auth.step_up.required' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert json.loads(row["details_json"])["route"] == "/alarm/panels/{entity_id}/actions"
    assert _act(c, HOUSE, "arm_night").status_code == 202  # arming is never gated
    assert _local_verify(app, s, c).status_code == 200
    r2 = _act(c, HOUSE, "disarm", confirmed=True)
    assert r2.status_code == 202, r2.text
    assert calls[-1]["service"] == "alarm_disarm"


def test_zone_bypass_is_gated_and_restoring_a_zone_is_not(gated_alarm):
    app, s, c, calls, enable = gated_alarm
    _no_code(c)
    enable()
    n = len(calls)
    r = _bypass(c, "binary_sensor.back_door", True, confirmed=True)
    assert r.status_code == 403 and r.json()["code"] == "step_up_required" and r.json()["details"]["action"] == "alarm.bypass"
    assert len(calls) == n
    assert _bypass(c, "binary_sensor.kitchen_window", False, confirmed=True).status_code == 202  # re-protecting a zone
    r2 = _act(c, HOUSE, "arm_custom_bypass")
    assert r2.status_code in (403, 422) and (r2.status_code == 422 or r2.json()["details"]["action"] == "alarm.bypass")
    assert _local_verify(app, s, c).status_code == 200
    assert _bypass(c, "binary_sensor.back_door", True, confirmed=True).status_code == 202


def test_the_personal_alarm_code_is_the_proof_for_that_one_alarm_action(gated_alarm):
    app, s, c, calls, enable = gated_alarm
    assert c.put(f"/api/v1/alarm/panels/{HOUSE}/code", json={"code": CODE}).status_code == 200
    assert c.put("/api/v1/alarm/users/dev-joni/pin", json={"pin": PIN}, headers=BOSS).status_code == 200
    enable()
    assert _act(c, HOUSE, "disarm", confirmed=True).json()["code"] == "code_required"  # the PIN is asked, not the step-up
    r = _act(c, HOUSE, "disarm", confirmed=True, code=PIN)
    assert r.status_code == 202, r.text
    with app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT * FROM audit_log WHERE action = 'alarm.disarm' AND decision = 'allowed' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert json.loads(row["details_json"])["step_up"] == "alarm_pin"
    # the PIN proved that one alarm action only: a settings change still needs the step-up
    assert c.patch("/api/v1/settings", json={"home.title": "x"}).json()["code"] == "step_up_required"


# ---------------------------------------------------------------- once-actions (grace 0)

def _owner_signed_in_with_a_target(arx, clock) -> None:
    owner_enrolled_and_stale(arx, clock)
    enrol(arx, arx.viewer)  # a target with a factor (signs the viewer in)
    bump_step(arx, "u-owner")
    assert fresh_login(arx, arx.owner, code_now(arx, "u-owner")).status_code == 200
    clock.advance(6)


def test_the_factor_reset_needs_a_proof_on_every_call_and_a_window_never_counts(arx, clock):
    _owner_signed_in_with_a_target(arx, clock)
    assert verify(arx, "u-owner").status_code == 200  # a window proof (settings) ...
    r = arx.client.request("DELETE", RESET, json={"confirm": "dana"})
    assert r.status_code == 403 and r.json()["code"] == "second_factor_step_up_required"  # ... does not count for a once-action
    d = r.json()["details"]
    assert d["once"] is True and d["action"] == "auth.second_factor.reset" and d["minutes"] == 0 and d["methods"] == ["totp"]
    v = verify(arx, "u-owner", action="auth.second_factor.reset")
    assert v.status_code == 200 and v.json()["minutes"] == 0 and v.json()["valid_until"]
    ok = arx.audit("auth.step_up.ok")[-1]
    assert details(ok)["once"] is True and details(ok)["action"] == "auth.second_factor.reset"
    assert arx.client.request("DELETE", RESET, json={"confirm": "dana"}).status_code == 200  # the once-proof, consumed by this call
    again = arx.client.request("DELETE", RESET, json={"confirm": "dana"})
    assert again.status_code == 403 and again.json()["code"] == "second_factor_step_up_required"  # never twice
    assert arx.audit("auth.step_up.required") == []  # the window gate leaves the route to its own check


def test_the_inline_code_still_works_and_a_wrong_one_is_audited_as_before(arx, clock):
    _owner_signed_in_with_a_target(arx, clock)
    r = arx.client.request("DELETE", RESET, json={"code": "000000", "confirm": "dana"})
    assert r.status_code == 400 and r.json()["code"] == "second_factor_invalid"
    assert arx.audit("auth.second_factor.reset")[-1]["reason"] == "step_up_invalid"
    bump_step(arx, "u-owner")
    assert arx.client.request("DELETE", RESET, headers={"X-Arx-Second-Factor": code_now(arx, "u-owner")}, json={"confirm": "dana"}).status_code == 200


def test_a_once_proof_is_bound_to_its_action_session_and_time(arx, clock):
    enrol(arx, arx.owner)
    a, b = fake_request(arx, "i:once-a"), fake_request(arx, "i:once-b")
    a.headers = b.headers = {}
    assert step_up.mark_once(a, OWNER, step_up.ONCE_RESET, "totp") is not None
    assert not step_up._take_once(a, OWNER, step_up.ONCE_REVEAL)  # another action
    assert not step_up._take_once(b, OWNER, step_up.ONCE_RESET)  # another sign-in
    clock.advance(1.1)  # past ONE_SHOT_S
    assert not step_up._take_once(a, OWNER, step_up.ONCE_RESET)
    step_up.mark_once(a, OWNER, step_up.ONCE_RESET, "totp")
    with arx.db.connection(mode="read") as conn:
        assert step_up.valid_until(conn, a, OWNER) is None  # a once-proof is never a window
        assert step_up.once_proof(conn, a, OWNER, step_up.ONCE_RESET, None) == "once"
        with pytest.raises(step_up.OnceProofMissing):
            step_up.once_proof(conn, a, OWNER, step_up.ONCE_RESET, None)
        with pytest.raises(ValueError):
            step_up.once_proof(conn, a, OWNER, "system.configure", "123456")


def test_a_once_proof_is_available_whatever_the_switch(arx, clock):
    _owner_signed_in_with_a_target(arx, clock)
    arx.setting("security.step_up", "off")
    assert verify(arx, "u-owner").json()["code"] == "step_up_not_applicable"  # no window proofs while off ...
    assert verify(arx, "u-owner", action="auth.second_factor.reset").status_code == 200  # ... but the reset still asks, as it always did
    assert arx.client.request("DELETE", RESET, json={"confirm": "dana"}).status_code == 200


# ---------------------------------------------------------------- the gaps of slice 1

def test_a_delegated_assigner_is_gated_too(arx, clock):
    enrol(arx, arx.owner)
    clock.advance(6)
    with arx.db.connection() as conn:
        post = fake_request(arx, "i:assign")
        step_up.attach(conn, post)
        try:
            with pytest.raises(ApiError) as e:
                rbac_admin.assigns_anywhere(conn, OWNER)
        finally:
            step_up.detach(conn)
        assert e.value.code == "step_up_required" and e.value.details["action"] == "rbac.assign"
        get = fake_request(arx, "i:assign-get", method="GET")
        step_up.attach(conn, get)
        try:
            assert rbac_admin.assigns_anywhere(conn, OWNER) is True  # a read is never gated
        finally:
            step_up.detach(conn)
        assert rbac_admin.assigns_anywhere(conn, OWNER) is True  # outside a request


def test_a_handler_that_opens_its_own_connection_is_inside_its_request(arx, clock):
    enrol(arx, arx.owner)
    clock.advance(6)
    scope = fake_request(arx, "i:own-conn").scope
    scope["headers"] = []
    token, holder = step_up.enter_request(scope)
    try:
        with pytest.raises(ApiError) as e:
            with arx.db.connection() as conn:  # never linked by auth._track
                require(conn, OWNER, "system.configure", INSTALLATION)
        assert e.value.code == "step_up_required"
        step_up.close_request(holder)  # the response started: a background task after it is never gated
        with arx.db.connection() as conn:
            require(conn, OWNER, "system.configure", INSTALLATION)
    finally:
        step_up.leave_request(token)
    assert step_up.current_request() is None


def test_read_only_post_routes_are_not_gated(arx, clock):
    owner_enrolled_and_stale(arx, clock)
    r = arx.client.post("/arx/api/v1/access/roles/preview", json={"permissions": ["video.live"], "sensitive": []})
    assert not (r.status_code == 403 and r.json().get("code") == "step_up_required"), r.text
    assert title(arx, "still gated").status_code == 403  # a real change is
    assert arx.audit("auth.step_up.required")[-1]["resource_id"] == "system.configure"


def test_door_automation_settings_granted_without_require_are_gated(arx, clock):
    owner_enrolled_and_stale(arx, clock)
    r = arx.client.put("/arx/api/v1/door-automations/settings", json={"confirmed": True, "limits": {"cooldown_s": 60}})
    assert r.status_code == 403 and r.json()["code"] == "step_up_required" and r.json()["details"]["action"] == "system.configure", r.text
    r2 = arx.client.put("/arx/api/v1/door-automations/kill", json={"on": True, "confirmed": True})
    assert r2.json().get("code") != "step_up_required"  # the emergency stop is never gated


def test_a_full_request_through_the_app_finds_its_request_context(arx, clock):
    """End to end through the middleware: the request context is set for the handler and gone after the response."""
    owner_enrolled_and_stale(arx, clock)
    assert title(arx, "ctx").status_code == 403
    assert step_up.current_request() is None
    local = TestClient(arx.app)
    assert local.get("/api/v1/auth/step-up").status_code == 200


# ---------------------------------------------------------------- the route-table ratchet
#
# tests/step_up_route_scan.py walks the code every write route can run and lists the gated permissions (settings / users /
# permissions, and the physical PHYSICAL_PERMISSIONS) it references outside require(). A route passes when it reaches an explicit
# gate (guard / guard_action / on_grant), is a once-action or a read-only route (services/step_up.py), or when every such reference
# is listed below with the reason it is not a gated change. A new route - or a new authority - that uses a gated permission without
# require() fails here until it is gated or listed.

# a reference that is never an authorisation of a gated change (wherever it appears)
ALLOWED_REFERENCES: dict[str, str] = {
    "rbac.admin_count": "counts the administrators (the last-administrator guard)",
    "routers.plan_view._payload": "view: what the answer shows a configurer",
    "routers.device_layouts._record": "view: who saved a layout is shown to configurers",
    "routers.camera_image_health._answer": "view: the can_manage flag of the answer",
    "routers.insights._settings_out": "view: the can_switch flag of the answer",
    "routers.insights._delivery_out": "view: the flags of the answer",
    "routers.water.status": "view: the water tab capability flags (water writes use the water permissions)",
    "services.incidents.serialize": "view: what an incident shows a configurer",
    "services.home_interface.is_admin": "the home-interface default of an administrator (a view mode)",
    "routers.notices._can": "an administrator may mark any notice read",
    "routers.playback._owned": "an administrator may close the playback session of another user (ownership override)",
    "routers.playback_groups._owned": "an administrator may close the playback group of another user (ownership override)",
    "routers.exports._owned": "an administrator may cancel the export of another user (ownership override)",
    "services.cast_sessions._can_manage": "casting a camera to a screen: an operational session, not a setting",
    "services.cast_sessions._visible": "casting sessions: which ones a configurer sees",
    "services.cast_sessions.start": "casting sessions: an administrator may start one anywhere (operational)",
    "routers.remote._who": "ending the remote sessions of another user protects; never gated (open question 6)",
    "routers.app_refresh._may_manage": "ending the phone-app sign-ins of another user protects; never gated (open question 6)",
    "routers.mobile_notifications.unregister_push": "removing the push registration of another user protects (open question 6)",
    "routers.presence.unregister_device": "removing the presence device of another user protects (open question 6)",
    "routers.views._can_edit": "saved views are screen layouts, not settings",
    "routers.views._can_manage_shared": "shared saved views are screen layouts, not permissions",
    "routers.access_control_schedule_writes._is_admin": "WisKey access schedules: operational (access.schedules.manage, slice-1 open question 5)",
    "routers.access_control_triage.may_manage": "WisKey triage of conflicts and alerts: operational",
    "routers.access_control_messaging._may_clear_opt_out": "the messaging consent of a person: operational",
    "routers.access_control_messaging.person_optout": "the messaging consent of a person: operational",
    "services.automation_ops.put_meta": "hiding a scene from lists (automation management, slice-1 open question 5)",
    "services.automation_scope.grant_reasons": "the permission a STORED automation step needs - judging the step, not performing it (open question 4)",
    "services.automation_scope.sensitive_steps_view": "the sensitive steps of an automation, for display (open question 4)",
    "services.schedule_view.action_reasons": "the permission a STORED schedule step needs - judging the step, not performing it (open question 4)",
    "services.door_automation.set_kill": "the door-automation emergency stop: never gated (owner 18.10, design 4.2)",
    "services.door_automation.status": "view: the door-automation switches",
    "routers.wiskey_validation.overview": "view of the acceptance checks (the opening is the separate pulse route, gated)",
    "routers.alarm._Scope.__init__": "the alarm scope of the caller (who may act where); the actions themselves are gated",
    "routers.alarm._check_actor": "who may hold a personal alarm code at all",
    "routers.alarm.set_my_pin": "the OWN alarm code of the caller, changed only with the current one (open question 3)",
    "routers.alarm._sole_configurer": "whether any OTHER administrator exists (the bootstrap of an own alarm code)",
    "routers.nvr_write._cameras": "the camera list a caller may see, filtered by permission",
    "services.rbac_admin._check_delegable_flag": "rbac.assign as data: a role that contains it may not be delegable",
    "services.rbac_admin._custom_role_dict": "rbac.assign as data: the role view",
    "services.rbac_admin.delegation_block": "rbac.assign as data: a role that contains it is never delegable",
    "services.local_identity.role_refusal": "identity.local.manage as data: a role an Arx-only user may not hold",
    "services.local_identity.sign_in": "the sign-in itself (not a change)",
    "services.local_passkeys.recovery_path_exists": "identity.local.manage as data: whether an administrator could recover the account",
    "services.tickets.contacts.may_edit_directory": "the tickets contact directory: operational records (tickets.directory or tickets.configure)",
    "services.tickets.contacts.may_edit_staff_rows": "the tickets contact directory: operational records",
    "services.tickets.phone_verify.manager_confirm": "a manager confirms the phone of a contact: operational",
    "services.tickets.portal_more.approver_scope": "approving a portal request: operational",
    "services.tickets.intake.may_manage_list": "the intake known-senders list: operational (tickets.intake or tickets.configure)",
    "services.maintenance.service._department_gate": "maintenance tasks of a department: operational",
    "services.access_grants.match_link": "access-grant links of ticket contacts: operational",
    "services.access_grants.may_edit_contacts": "access-grant links of ticket contacts: operational",
    "services.access_grants.unlink": "access-grant links of ticket contacts: operational",
    "services.access_grants.accept_pending_contact": "a pending access-grant contact: operational",
    "services.access_grants.reject_pending_contact": "a pending access-grant contact: operational",
}

# a refinement that runs AFTER the route's own gated require() (the route must have one, which the hook gates)
AFTER_REQUIRE: dict[str, str] = {
    "services.rbac_admin.full_authority": "refines the reach of a delegated administrator after the route's rbac.assign / rbac.roles.manage require()",
    "services.rbac_admin.scope_in_reach": "refines the reach of a delegated administrator after the route's require()",
    "services.rbac_admin.check_delegation": "the delegation limits after the route's require()",
    "routers.doors.switch_role": "access.doors.open as data, added to a role after require(rbac.roles.manage)",
    "routers.catalog.put_home_link": "a second floor's site.content.configure after the first require() (RemapGuard)",
    "routers.catalog.delete_building": "the building's site.content.configure again after the route's require() (RemapGuard, FIX-MH01-2560)",
    "routers.catalog.delete_floor": "the floor's site.content.configure again after the route's require() (RemapGuard, FIX-MH01-2560)",
    "routers.home_mapping.apply_mapping": "a second building's site.content.configure after the first require() (RemapGuard)",
    "routers.home_mapping.restore_version": "a second building's site.content.configure after the first require() (RemapGuard)",
    "routers.nvr_write._camera_config_scope": "the camera's own chain after the route's installation-wide require()",
    "services.nvr_batch._new_batch": "the batch targets after the route's require(nvr.configure)",
    "services.nvr_batch.batch_status": "the batch view after the route's require(nvr.configure)",
    "services.nvr_settings._insert_pending": "the pending row after the route's require(nvr.configure)",
}

# routes that judge a door / alarm permission without opening or disarming anything now
ALLOWED_ROUTES: dict[tuple[str, str], str] = {
    ("POST", "/floors/{floor_id}/anchors"): "placing a door lock on a map needs door.unlock for it (SEC-WXD M2); nothing opens (open question 2)",
    ("DELETE", "/map-anchors/{anchor_id}"): "taking a door lock off a map needs door.unlock for it; nothing opens (open question 2)",
    ("POST", "/door-automations/{block_id}/arm"): "arming a door-automation block: its later openings are background runs (open question 2)",
    ("POST", "/door-automations/{block_id}/simulate"): "a simulation: nothing is sent",
    ("POST", "/intercom/door-path-conversion/actions"): "converting a door step to the door path: judged, nothing opens",
}

# the routes this slice gates explicitly: each must reach guard_action / on_grant
MUST_GUARD = {
    ("POST", "/alarm/panels/{entity_id}/actions"), ("POST", "/alarm/zones/{zone_entity_id}/bypass"),
    ("POST", "/ha/entities/{entity_id}/actions"), ("POST", "/intercom/stations/{station_id}/release"),
    ("POST", "/doors/windows/doors/{station_id}/{relay}/open-for"), ("POST", "/wiskey-validation/pulse"),
    ("POST", "/automations/automation/{item_id}/run"), ("POST", "/automations/script/{item_id}/run"), ("POST", "/automations/scene/{item_id}/apply"),
    ("DELETE", "/access/bindings/{binding_id}"), ("PUT", "/access/groups/{group_id}/members"),
    ("POST", "/access/groups/{group_id}/bindings"), ("DELETE", "/access/groups/{group_id}/bindings/{binding_id}"),
    ("PUT", "/door-automations/settings"), ("PUT", "/door-automations/users/{user_id}"), ("PUT", "/access/visitors/entrances/{station_id}"),
    ("PUT", "/tickets/costs/departments/{dept_id}"), ("POST", "/tickets/intake/lexicon"), ("DELETE", "/tickets/intake/lexicon/{lexicon_id}"),
    ("POST", "/access-control/stations/{station_id}/codes/{slot}"), ("POST", "/access-control/stations/{station_id}/doors/{door}/hold"),
    ("POST", "/access-control/stations/{station_id}/doors/{door}/program"),
}


def _short(qualname: str) -> str:
    return qualname.removeprefix("smplwise.")


@pytest.fixture(scope="module")
def route_table(tmp_path_factory):
    from step_up_route_scan import Scanner, write_routes

    from smplwise.config import Settings
    from smplwise.main import create_app

    tmp = tmp_path_factory.mktemp("ratchet")
    app = create_app(Settings(data_dir=tmp / "data", www_dir=None, in_addon=False, trusted_proxies=("172.30.32.2",), dev_user="joni",
                              bootstrap_admin_username="joni", nvr_host="nvr-placeholder.test", nvr_http_port=80, nvr_user=None, nvr_password=None,
                              go2rtc_url=None, log_level="warning", max_upload_bytes=5 * 1024 * 1024, max_pdf_pages=5, max_render_px=800, preview_px=300))
    scanner = Scanner(step_up.GATED_PERMISSIONS | step_up.PHYSICAL_PERMISSIONS)
    return {(m, p): scanner.route_summary(r) for m, p, r in write_routes(app)}


def _open_references(key, su) -> list[tuple[str, str]]:
    if su.guards or key in ALLOWED_ROUTES or key in step_up.ONCE_ROUTES or key in step_up.READ_ONLY_ROUTES:
        return []
    return sorted((p, _short(f)) for p, f in su.refs if _short(f) not in ALLOWED_REFERENCES and not (_short(f) in AFTER_REQUIRE and su.hooked))


def test_every_write_route_that_uses_a_gated_permission_is_gated_or_listed(route_table):
    assert len(route_table) > 500  # the whole table was walked
    problems = {f"{m} {p}": refs for (m, p), su in sorted(route_table.items()) if (refs := _open_references((m, p), su))}
    assert not problems, "gate these routes (step_up.guard_action / on_grant) or list them with a reason:\n" + json.dumps(problems, indent=1, ensure_ascii=False)


def test_the_routes_gated_by_this_slice_reach_their_gate(route_table):
    missing = sorted(f"{m} {p}" for m, p in MUST_GUARD if (m, p) not in route_table or not route_table[(m, p)].guards)
    assert not missing, missing


def test_every_listed_exception_names_a_live_route_or_reference(route_table):
    used = {_short(f) for su in route_table.values() for _, f in su.refs}
    assert not set(ALLOWED_REFERENCES) - used, sorted(set(ALLOWED_REFERENCES) - used)
    assert not set(AFTER_REQUIRE) - used, sorted(set(AFTER_REQUIRE) - used)
    stale = [k for k in (*ALLOWED_ROUTES, *step_up.READ_ONLY_ROUTES, *step_up.ONCE_ROUTES) if k not in route_table]
    assert not stale, stale
    assert all(route_table[k].refs for k in ALLOWED_ROUTES)  # a listed route that no longer references anything is dropped from the list
