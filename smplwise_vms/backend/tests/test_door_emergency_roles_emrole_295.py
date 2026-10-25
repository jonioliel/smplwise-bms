"""EMROLE-295 (owner decisions 2026-10-24): the built-in emergency-open role for people who are not system administrators.

- a system administrator AND a holder of the built-in `security_manager` role may grant it (that role holds the one permission `emergency.open.grant` and no other
  power); nobody else may, and a security manager never grants it to themselves or beyond the longest expiry;
- a temporary assignment carries an expiry that the SERVER enforces at use time (the binding query drops an expired binding on every authorization);
- the explicit retry-open after an UNKNOWN (WKOPENUNK-295) is open to holders of the emergency-open role as well as to administrators - the door's name typed, one at a
  time, 10 s apart - and refused to a non-holder and to an expired holder; its audit row records who holds which role at the moment;
- the defaults (expiry, maximum, who may grant, whether holders may retry) are settings, every change audited.
Fakes only (`ScriptedEmergencyEngine`): nothing reaches WisKey, Home Assistant, a station or a door."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from fake_doorwin_adapters import ProductWorld

from smplwise.rbac import ROLES
from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE
from smplwise.services import door_emergency as de
from smplwise.services import door_windows_engine as dwe

PAST = "2000-01-01T00:00:00Z"


@pytest.fixture()
def pw(settings, monkeypatch):
    w = ProductWorld(settings, monkeypatch, go_live=True)
    w.emergency_on()
    monkeypatch.setattr(dwe.WiskeyEmergencyEngine, "open_supported", True)
    assert w.post("/doors/emergency/attestation", version=de.ATTESTATION_VERSION, accepted=True, confirmed=True).status_code == 200
    assert w.put("/doors/emergency/settings", changes={"doors.emergency.open_enabled": "on"}, confirmed=True).status_code == 200
    for who in ("guard", "temp", "desk", "sam", "outsider", "viewer", "admin2"):
        w.get("/me", who)  # the person exists
    return w


def grant(pw, by: str | None, who: str = "guard", **extra):
    return pw.post("/doors/emergency/grants", by, user_id=f"dev-{who}", scope_type="installation", scope_id="*", confirmed=True, **extra)


def at(pw, hours: float) -> str:
    return (pw.t[0] + dt.timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%SZ")


def audit_rows(pw, action: str) -> list[dict]:
    return [dict(r, details=json.loads(r["details_json"] or "{}")) for r in pw.rows("SELECT decision, reason, details_json FROM audit_log WHERE action = ? ORDER BY id", action)]


def can_open(pw, who: str) -> bool:
    return pw.post("/doors/emergency/prepare", who, action="start", kind="open", drill=True).status_code == 200


# ---------------------------------------------------------------- the catalogue

def test_the_security_manager_role_holds_the_grant_permission_and_nothing_administrative():
    assert ROLES["security_manager"] == ["access.read", "access.stations.read", "emergency.open.grant"]
    assert "emergency.open.grant" in SENSITIVE and PERMISSION_LABELS.get("emergency.open.grant")
    assert sorted(r for r, p in ROLES.items() if "emergency.open.grant" in p) == ["security_manager", "system_admin"]
    assert not {"rbac.assign", "rbac.roles.manage", "system.configure"} & set(ROLES["security_manager"])
    assert sorted(r for r, p in ROLES.items() if "access.emergency.open" in p) == ["emergency_open", "system_admin"], "the OPEN permission itself did not move"


# ---------------------------------------------------------------- who may grant

def test_a_system_administrator_grants_with_the_default_expiry_and_the_person_can_then_open(pw):
    assert not can_open(pw, "guard")
    r = grant(pw, None)
    assert r.status_code == 201, r.text
    g = r.json()["grant"]
    assert g["expires_at"] == at(pw, 24), "the default expiry (24 h) from the settings"
    assert can_open(pw, "guard")
    st = pw.get("/doors/emergency/state", "guard").json()
    assert st["can"]["open"] is True and st["can"]["grant"] is False, "a holder of the role does not thereby grant it"
    rows = audit_rows(pw, "door.emergency.grant")
    assert len(rows) == 1 and rows[0]["decision"] == "allowed" and rows[0]["details"]["granter_basis"] == "system_admin" and rows[0]["details"]["expires_at"] == g["expires_at"]
    assert any(r["details"].get("via") == "emergency_grant" for r in audit_rows(pw, "rbac.bind")), "the generic binding row is written too"


def test_a_security_manager_grants_inside_the_limits_and_gains_no_other_power(pw):
    pw.bind("sam", "security_manager")
    st = pw.get("/doors/emergency/state", "sam").json()
    assert st["can"]["grant"] is True and st["can"]["open"] is False
    r = grant(pw, "sam", "temp", expires_at=at(pw, 8))
    assert r.status_code == 201, r.text
    assert r.json()["grant"]["expires_at"] == at(pw, 8) and can_open(pw, "temp")
    assert audit_rows(pw, "door.emergency.grant")[0]["details"]["granter_basis"] == "security_manager"
    assert any(x["role"] == "security_manager" for x in audit_rows(pw, "door.emergency.grant")[0]["details"]["granter_roles"])
    # no default given: the default expiry applies; never beyond the maximum; never without an expiry; never to oneself
    assert grant(pw, "sam", "desk").json()["grant"]["expires_at"] == at(pw, 24)
    r = grant(pw, "sam", "viewer", expires_at=at(pw, 24 * 30))
    assert r.status_code == 422 and r.json()["code"] == "expiry_too_long"
    r = grant(pw, "sam", "viewer", no_expiry=True)
    assert r.status_code == 422 and r.json()["code"] == "expiry_required"
    r = grant(pw, "sam", "viewer", expires_at=PAST)
    assert r.status_code == 422 and r.json()["code"] == "expiry_past"
    r = grant(pw, "sam", "sam", expires_at=at(pw, 1))
    assert r.status_code == 403 and r.json()["code"] == "grant_self"
    # the permission opens this module only
    assert pw.post("/access/bindings", "sam", subject_kind="user", subject_id="dev-viewer", role_id="emergency_open", scope_type="installation", scope_id="*").status_code == 403
    assert pw.post("/access/bindings", "sam", subject_kind="user", subject_id="dev-viewer", role_id="viewer", scope_type="installation", scope_id="*").status_code == 403
    assert pw.post("/doors/emergency/prepare", "sam", action="start", kind="open", drill=True).status_code == 403
    assert pw.put("/doors/emergency/settings", "sam", changes={"doors.emergency.grant.max_hours": "720"}, confirmed=True).status_code == 403
    denied = [r["reason"] for r in audit_rows(pw, "door.emergency.grant") if r["decision"] == "denied"]
    assert {"expiry_too_long", "expiry_required", "expiry_past", "grant_self"} <= set(denied)


def test_an_administrator_may_grant_without_an_expiry_or_a_long_one(pw):
    g = grant(pw, None, "guard", no_expiry=True).json()["grant"]
    assert g["expires_at"] is None
    assert grant(pw, None, "temp", expires_at=at(pw, 24 * 60)).status_code == 201


@pytest.mark.parametrize("role", ["viewer", "operator", "site_admin", "emergency_open", "emergency_lock", "door_windows_manager"])
def test_nobody_else_grants_or_even_reads_the_holders(pw, role):
    pw.bind("outsider", role)
    assert grant(pw, "outsider", "guard", expires_at=at(pw, 2)).status_code == 403
    assert pw.get("/doors/emergency/grants", "outsider").status_code == 403
    assert not can_open(pw, "guard")
    assert pw.get("/doors/emergency/state", "outsider").json()["can"]["grant"] is False
    assert audit_rows(pw, "door.emergency.grant")[-1]["reason"] == "grant_not_allowed"


def test_a_security_manager_is_off_when_the_setting_is_off_and_a_scoped_one_acts_only_there(pw):
    pw.bind("sam", "security_manager")
    assert pw.put("/doors/emergency/settings", changes={"doors.emergency.grant.by_security_manager": "off"}, confirmed=True).status_code == 200
    assert grant(pw, "sam", "guard", expires_at=at(pw, 2)).status_code == 403
    assert pw.get("/doors/emergency/state", "sam").json()["can"]["grant"] is False
    assert grant(pw, None, "temp", expires_at=at(pw, 2)).status_code == 201, "a system administrator always may"
    assert pw.put("/doors/emergency/settings", changes={"doors.emergency.grant.by_security_manager": "on"}, confirmed=True).status_code == 200
    assert grant(pw, "sam", "guard", expires_at=at(pw, 2)).status_code == 201


def test_a_scoped_security_manager_cannot_grant_outside_the_scope(pw):
    with pw.db.connection() as conn:
        from smplwise.db import new_id

        site = new_id()
        conn.execute("INSERT INTO sites(id, name, created_at, updated_at) VALUES (?, 'Site', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')", (site,))
    pw.bind("sam", "security_manager", "site", site)
    r = grant(pw, "sam", "guard", expires_at=at(pw, 2))
    assert r.status_code == 403, "installation scope is outside a site-scoped manager"
    r = pw.post("/doors/emergency/grants", "sam", user_id="dev-guard", scope_type="site", scope_id=site, expires_at=at(pw, 2), confirmed=True)
    assert r.status_code == 201, r.text


def test_the_confirmation_flag_is_required(pw):
    r = pw.post("/doors/emergency/grants", None, user_id="dev-guard", scope_type="installation", scope_id="*")
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required"


# ---------------------------------------------------------------- expiry at use time, revoke, listing

def test_an_expired_assignment_is_refused_at_use_time(pw):
    assert grant(pw, None, "temp", expires_at=at(pw, 1)).status_code == 201
    assert can_open(pw, "temp")
    with pw.db.connection() as conn:  # the hour passes
        conn.execute("UPDATE bindings SET expires_at = ? WHERE subject_id = 'dev-temp' AND role_id = 'emergency_open'", (PAST,))
    assert not can_open(pw, "temp"), "the server drops the expired binding on the next authorization"
    assert pw.get("/doors/emergency/state", "temp").status_code == 403, "with the grant gone the person holds no right at all (the role also carried the reads)"
    holders = pw.get("/doors/emergency/grants").json()["holders"]
    assert all(h["subject_id"] != "dev-temp" for h in holders), "an expired grant is no longer listed"


def test_listing_revoking_and_the_refusals(pw):
    pw.bind("sam", "security_manager")
    a = grant(pw, "sam", "guard", expires_at=at(pw, 5)).json()["grant"]
    v = pw.get("/doors/emergency/grants", "sam").json()
    assert v["basis"] == "security_manager" and v["can_no_expiry"] is False and v["max_hours"] == 168 and v["default_hours"] == 24
    assert [h["subject_id"] for h in v["holders"]] == ["dev-guard"] and v["holders"][0]["expires_at"] == at(pw, 5)
    assert any(c["id"] == "dev-guard" for c in v["candidates"])
    assert v["scopes"][0]["scope_type"] == "installation"
    assert grant(pw, "sam", "guard", expires_at=at(pw, 6)).json()["code"] == "grant_exists"
    pw.bind("outsider", "viewer")
    assert pw.post(f"/doors/emergency/grants/{a['id']}/revoke", "outsider", confirmed=True).status_code == 403
    assert pw.post(f"/doors/emergency/grants/{a['id']}/revoke", "sam").json()["code"] == "confirmation_required"
    assert can_open(pw, "guard")
    r = pw.post(f"/doors/emergency/grants/{a['id']}/revoke", "sam", confirmed=True)
    assert r.status_code == 200, r.text
    assert not can_open(pw, "guard")
    assert pw.post(f"/doors/emergency/grants/{a['id']}/revoke", "sam", confirmed=True).status_code == 404
    rows = [r for r in audit_rows(pw, "door.emergency.grant_revoke") if r["decision"] == "allowed"]
    assert len(rows) == 1 and rows[0]["details"]["revoker_basis"] == "security_manager"
    # another role is never revoked through this route
    other = pw.get("/access/bindings").json()["bindings"]
    sam_binding = next(b for b in other if b["subject_id"] == "dev-sam")
    assert pw.post(f"/doors/emergency/grants/{sam_binding['id']}/revoke", None, confirmed=True).status_code == 404


def test_the_settings_are_editable_validated_and_audited(pw):
    r = pw.put("/doors/emergency/settings", changes={"doors.emergency.grant.default_hours": "12", "doors.emergency.grant.max_hours": "48"}, confirmed=True)
    assert r.status_code == 200 and r.json()["settings"]["doors.emergency.grant.default_hours"] == "12"
    assert grant(pw, None, "guard").json()["grant"]["expires_at"] == at(pw, 12)
    for bad in ({"doors.emergency.grant.default_hours": "49"}, {"doors.emergency.grant.max_hours": "11"}, {"doors.emergency.grant.max_hours": "0"},
                {"doors.emergency.grant.default_hours": "x"}, {"doors.emergency.retry_open.by_holders": "maybe"}):
        assert pw.put("/doors/emergency/settings", changes=bad, confirmed=True).status_code == 422, bad
    changed = {r["details"]["key"] for r in audit_rows(pw, "settings.changed") if r["decision"] == "allowed"}
    assert {"doors.emergency.grant.default_hours", "doors.emergency.grant.max_hours"} <= changed
    # a default of 0: an administrator's grant has no expiry, a security manager's is held to the maximum
    assert pw.put("/doors/emergency/settings", changes={"doors.emergency.grant.default_hours": "0"}, confirmed=True).status_code == 200
    assert grant(pw, None, "temp").json()["grant"]["expires_at"] is None
    pw.bind("sam", "security_manager")
    assert grant(pw, "sam", "desk").json()["grant"]["expires_at"] == at(pw, 48)


# ---------------------------------------------------------------- the retry-open action

def tick(pw, seconds: int) -> None:
    pw.t[0] += dt.timedelta(seconds=seconds)


def door_row(pw, iid: str) -> dict:
    return pw.rows("SELECT state, attempts FROM door_emergency_doors WHERE incident_id = ? AND station_id = ? AND relay = 1 AND phase = 'apply'", iid, pw.ENTRY)[0]


def apply_calls(pw) -> list:
    return [c for c in pw.emergency.calls if c["door"] == f"{pw.ENTRY}:1" and c["phase"] == "apply"]


def retry(pw, iid: str, user: str | None):
    return pw.post(f"/doors/emergency/incidents/{iid}/retry-open", user, station_id=pw.ENTRY, relay=1, confirm_door="כניסה ראשית")


def unknown_open(pw) -> str:
    pw.emergency.script = {f"{pw.ENTRY}:1": ["unknown", "acknowledged"]}
    iid = pw.press("open").json()["incident"]["id"]
    tick(pw, 11)
    return iid


def test_a_role_holder_retries_after_an_unknown_and_the_audit_records_the_roles(pw):
    exp = at(pw, 8)
    assert grant(pw, None, "guard", expires_at=exp).status_code == 201
    iid = unknown_open(pw)
    st = pw.get("/doors/emergency/state", "guard").json()
    assert st["active"]["can_retry_open"] is True and st["active"]["can_release"] is True
    wrong = pw.post(f"/doors/emergency/incidents/{iid}/retry-open", "guard", station_id=pw.ENTRY, relay=1, confirm_door="דלת")
    assert wrong.status_code == 409 and wrong.json()["code"] == "confirm_door_required", "the door's name is typed every time, for a holder too"
    r = retry(pw, iid, "guard")
    assert r.status_code == 200, r.text
    assert len(apply_calls(pw)) == 2 and door_row(pw, iid)["state"] == "acknowledged"
    assert retry(pw, iid, "guard").json()["code"] == "door_not_unknown", "one attempt, no second"
    rows = [r for r in audit_rows(pw, "door.emergency.retry_open") if r["decision"] == "allowed"]
    assert len(rows) == 1
    d = rows[0]["details"]
    assert d["earlier_outcome"] == "unknown" and d["actor_basis"] == "emergency_open_holder"
    assert {"role": "emergency_open", "scope": "installation:*", "expires_at": exp} in d["actor_roles"]
    assert any(h["subject"] == "user:dev-guard" and h["expires_at"] == exp for h in d["emergency_open_holders"])


def test_the_retry_keeps_the_existing_guards_for_a_holder(pw):
    assert grant(pw, None, "guard", expires_at=at(pw, 8)).status_code == 201
    pw.emergency.script = {f"{pw.ENTRY}:1": ["unknown", "acknowledged"], f"{pw.SIDE}:1": ["unknown", "acknowledged"]}
    iid = pw.press("open").json()["incident"]["id"]
    assert retry(pw, iid, "guard").json()["code"] == "too_soon"
    tick(pw, 11)
    for _ in range(3):  # nothing is ever resent on its own
        tick(pw, 10)
        de.retry_tick(pw.db, pw.settings, pw.t[0])
    assert len(apply_calls(pw)) == 1 and de.DW09_OPEN_RETRY_AFTER_UNKNOWN is False
    with pw.db.connection() as conn:
        conn.execute("UPDATE door_emergency_doors SET state = 'sent' WHERE incident_id = ? AND station_id = ? AND phase = 'apply'", (iid, pw.SIDE))
    assert retry(pw, iid, "guard").json()["code"] == "retry_in_progress"


def test_a_non_holder_and_an_expired_holder_are_refused_the_retry(pw):
    assert grant(pw, None, "temp", expires_at=at(pw, 1)).status_code == 201
    iid = unknown_open(pw)
    pw.bind("viewer", "viewer")
    pw.bind("outsider", "emergency_lock")  # the lock right is not the open right
    for who in ("viewer", "outsider", "desk"):
        r = retry(pw, iid, who)
        assert r.status_code == 403 and r.json()["code"] in ("retry_not_allowed", "forbidden"), (who, r.text)
    assert pw.get("/doors/emergency/state", "viewer").json()["active"]["can_retry_open"] is False
    assert pw.get("/doors/emergency/state", "outsider").json()["active"]["can_retry_open"] is False
    with pw.db.connection() as conn:  # the temporary assignment lapses
        conn.execute("UPDATE bindings SET expires_at = ? WHERE subject_id = 'dev-temp' AND role_id = 'emergency_open'", (PAST,))
    r = retry(pw, iid, "temp")
    assert r.status_code == 403 and r.json()["code"] == "retry_not_allowed"
    assert pw.get("/doors/emergency/state", "temp").status_code == 403
    assert len(apply_calls(pw)) == 1, "nothing was sent"
    assert {r["reason"] for r in audit_rows(pw, "door.emergency.retry_open") if r["decision"] == "denied"} >= {"retry_not_allowed"}
    assert retry(pw, iid, None).status_code == 200, "a system administrator still may"


def test_the_retry_by_holders_can_be_switched_off(pw):
    assert grant(pw, None, "guard", expires_at=at(pw, 8)).status_code == 201
    iid = unknown_open(pw)
    assert pw.put("/doors/emergency/settings", changes={"doors.emergency.retry_open.by_holders": "off"}, confirmed=True).status_code == 200
    assert retry(pw, iid, "guard").json()["code"] == "retry_not_allowed"
    assert pw.get("/doors/emergency/state", "guard").json()["active"]["can_retry_open"] is False
    assert retry(pw, iid, None).status_code == 200


def test_a_holder_scoped_to_another_station_cannot_retry_this_door(pw):
    pw.bind("desk", "emergency_open", "access_control_station", pw.SIDE)
    iid = unknown_open(pw)
    r = retry(pw, iid, "desk")
    assert r.status_code == 403 and r.json()["code"] == "retry_not_allowed"
    assert len(apply_calls(pw)) == 1


# ---------------------------------------------------------------- a local (Arx-only) identity: the one exception to "one binding"

def test_a_local_identity_with_a_role_also_holds_emergency_open_expiry_bound_and_audited(pw):
    from smplwise.db import new_id, now_iso, permission_revision
    from smplwise.rbac import Principal, permissions_anywhere

    uid = "l_clerk0000001"
    with pw.db.connection() as conn:
        conn.execute("INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) VALUES (?, 'clerk', 'Clerk', 'local', 1, ?, ?)", (uid, now_iso(), now_iso()))
        conn.execute("""INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at)
                        VALUES (?, 'user', ?, 'operator', 'installation', '*', 'allow', ?, 'test', ?)""", (new_id(), uid, permission_revision(conn), now_iso()))
    r = pw.post("/doors/emergency/grants", None, user_id=uid, scope_type="installation", scope_id="*", no_expiry=True, confirmed=True)
    assert r.status_code == 422 and r.json()["code"] == "expiry_required", "a local identity's grant is always expiry-bound"
    r = pw.post("/doors/emergency/grants", None, user_id=uid, scope_type="installation", scope_id="*", expires_at=at(pw, 6), confirmed=True)
    assert r.status_code == 201, r.text
    with pw.db.connection(mode="read") as conn:
        perms = permissions_anywhere(conn, Principal(user_id=uid, username="clerk", display_name="Clerk", source="local"))
        assert de.OPEN in perms and "devices.read" in perms, "the emergency-open right is added to the person's own role"
    row = audit_rows(pw, "door.emergency.grant")[-1]
    assert row["decision"] == "allowed" and row["details"]["expires_at"] == at(pw, 6)
    # the exception is this role only: a second ordinary role is still refused
    r = pw.post("/access/bindings", None, subject_kind="user", subject_id=uid, role_id="viewer", scope_type="installation", scope_id="*")
    assert r.status_code == 409 and r.json()["code"] == "local_user_one_binding"
