"""SVCIDENT-AMEND273 (owner decision 5 of 2026-10-18, go-live pack RESIDUAL_RISK R7): the REMOTE kill switch of the extended mode.

Until 2.7.2 the add-on switch `security.local_identity_extended` changed only from the local channel, in BOTH directions, and the runnable
allowlist was edited only locally (`PUT /identity/service-identity/runnable` is prefix-blocked on the remote channel). The owner decided:
a system administrator may turn the extended mode OFF - never ON - and clear the allowlist from the remote channel too, WITHOUT a second
factor (decision 2/5), audited. Turning it ON stays local-only; the full allowlist editor stays local-only; the go-live permit is untouched.

Fakes only: no Home Assistant, no device, no lab secrets."""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from smplwise.db import get_setting, set_setting
from smplwise.services import service_identity as si
from test_local_identity import lx  # noqa: F401 (fixture)

KILL = "/api/v1/identity/extended-mode/off"
LISTED = ["scene.evening", "script.open_front"]


@pytest.fixture(autouse=True)
def _go_live_permit(request, monkeypatch):
    """The ON direction needs the go-live permit, which this build does not have (EXTENDED_GO_LIVE_PERMITTED = False, unchanged here).
    Tests that need a stored ON value write it directly; the tests that ask for ON over HTTP set the permit so the channel check (not the
    permit) is what refuses - exactly the future enabled build."""
    if "with_the_permit" in request.node.name:
        monkeypatch.setattr(si, "EXTENDED_GO_LIVE_PERMITTED", True)


def _store(lx, *, ext: str = "on", runnable: list[str] | None = None) -> None:
    with lx.db.connection() as conn:
        set_setting(conn, si.EXTENDED_SETTING, ext)
        set_setting(conn, si.RUNNABLE_SETTING, json.dumps(LISTED if runnable is None else runnable))


def _ext(lx) -> str:
    with lx.db.connection(mode="read") as conn:
        return get_setting(conn, si.EXTENDED_SETTING, "off") or "off"


def _listed(lx) -> list[str]:
    with lx.db.connection(mode="read") as conn:
        return sorted(si.runnable_ids(conn))


def _remote_admin(lx) -> TestClient:
    """A Home Assistant person bound system_admin, signed in on the remote channel (no second factor: owner decision 5)."""
    lx.flag("u-owner")
    lx.bind("u-owner", "system_admin")
    assert lx.login(lx.owner).status_code == 200
    return lx.client


def _rows(lx, action: str) -> list[dict]:
    return lx.rows("SELECT actor_user_id, decision, reason, details_json FROM audit_log WHERE action = ? ORDER BY rowid", (action,))


# ---------------------------------------------------------------- the settings switch: OFF remotely yes, ON remotely never

def test_remote_on_is_refused_even_with_the_permit(lx):
    c = _remote_admin(lx)
    _store(lx, ext="off")
    r = c.patch("/arx/api/v1/settings", json={"security.local_identity_extended": "on"})
    assert r.status_code == 403 and r.json()["code"] == "local_only", r.text
    assert _ext(lx) == "off"
    assert not [row for row in _rows(lx, "identity.service_identity.extended_switch") if row["decision"] == "allowed"]
    assert json.loads(_rows(lx, "identity.local.setting_local_only")[-1]["details_json"])["key"] == "security.local_identity_extended"


def test_remote_off_works_for_a_system_administrator_and_is_audited(lx):
    c = _remote_admin(lx)
    _store(lx, ext="on")
    r = c.patch("/arx/api/v1/settings", json={"security.local_identity_extended": "off"})
    assert r.status_code == 200, r.text
    assert _ext(lx) == "off"
    row = _rows(lx, "identity.service_identity.extended_switch")[-1]
    details = json.loads(row["details_json"])
    assert row["decision"] == "allowed" and row["actor_user_id"] == "u-owner"
    assert (details["from"], details["to"], details["channel"]) == ("on", "off", "remote")
    assert _listed(lx) == LISTED  # the switch alone leaves the allowlist as it is


def test_remote_off_is_refused_to_a_non_administrator(lx):
    lx.flag("u-viewer")
    lx.bind("u-viewer", "viewer")
    assert lx.login(lx.viewer).status_code == 200
    _store(lx, ext="on")
    assert lx.client.patch("/arx/api/v1/settings", json={"security.local_identity_extended": "off"}).status_code == 403
    assert _ext(lx) == "on"


def test_local_switch_behaviour_is_unchanged_with_the_permit(lx):
    lx.enable()
    assert lx.admin.patch("/api/v1/settings", json={"security.local_identity_extended": "on"}).status_code == 200
    assert lx.admin.patch("/api/v1/settings", json={"security.local_identity_extended": "off"}).status_code == 200
    vera = TestClient(lx.app, headers={"X-SW-Dev-User": "vera"})
    assert vera.patch("/api/v1/settings", json={"security.local_identity_extended": "on"}).status_code == 403
    sw = [json.loads(r["details_json"]) for r in _rows(lx, "identity.service_identity.extended_switch") if r["decision"] == "allowed"]
    assert [(d["from"], d["to"]) for d in sw] == [("off", "on"), ("on", "off")]


def test_local_on_still_needs_the_go_live_permit(lx):
    r = lx.admin.patch("/api/v1/settings", json={"security.local_identity_extended": "on"})
    assert r.status_code == 409 and r.json()["code"] == "extended_not_permitted"
    assert si.EXTENDED_GO_LIVE_PERMITTED is False  # this change never flips the permit


# ---------------------------------------------------------------- the kill route: off and / or clear the allowlist, any channel

def test_remote_kill_turns_off_and_clears_the_allowlist(lx):
    c = _remote_admin(lx)
    _store(lx, ext="on")
    r = c.post("/arx" + KILL, json={})
    assert r.status_code == 200, r.text
    assert r.json() == {"extended": "off", "runnable_count": 0, "turned_off": True, "cleared": 2}
    assert _ext(lx) == "off" and _listed(lx) == []
    kill = _rows(lx, "identity.service_identity.kill_switch")[-1]
    details = json.loads(kill["details_json"])
    assert kill["decision"] == "allowed" and kill["actor_user_id"] == "u-owner"
    assert (details["turned_off"], details["cleared"], details["channel"]) == (True, 2, "remote")
    sw = json.loads(_rows(lx, "identity.service_identity.extended_switch")[-1]["details_json"])
    assert (sw["from"], sw["to"]) == ("on", "off")
    rl = json.loads(_rows(lx, "identity.service_identity.runnable")[-1]["details_json"])
    assert rl["removed"] == LISTED and rl["count"] == 0
    assert "configured_user_id" not in r.json()  # the remote answer never carries the service identity's configuration


def test_remote_clear_only_leaves_the_switch(lx):
    c = _remote_admin(lx)
    _store(lx, ext="on")
    r = c.post("/arx" + KILL, json={"turn_off": False, "clear_runnable": True})
    assert r.status_code == 200 and r.json()["turned_off"] is False and r.json()["cleared"] == 2
    assert _ext(lx) == "on" and _listed(lx) == []


def test_remote_off_only_keeps_the_allowlist(lx):
    c = _remote_admin(lx)
    _store(lx, ext="on")
    r = c.post("/arx" + KILL, json={"turn_off": True, "clear_runnable": False})
    assert r.status_code == 200 and r.json()["turned_off"] is True and r.json()["cleared"] == 0
    assert _ext(lx) == "off" and _listed(lx) == LISTED


def test_the_kill_route_never_turns_anything_on_with_the_permit(lx):
    c = _remote_admin(lx)
    _store(lx, ext="off", runnable=[])
    for body in ({"turn_on": True}, {"extended": "on"}, {"runnable": ["script.open_front"]}, {"turn_off": "on"}):
        assert c.post("/arx" + KILL, json=body).status_code == 422, body
    assert c.post("/arx" + KILL, json={"turn_off": False, "clear_runnable": False}).status_code == 422  # nothing to do
    r = c.post("/arx" + KILL, json={})  # already off and empty: idempotent, still off
    assert r.status_code == 200 and r.json() == {"extended": "off", "runnable_count": 0, "turned_off": False, "cleared": 0}
    assert _ext(lx) == "off" and _listed(lx) == []
    assert not [row for row in _rows(lx, "identity.service_identity.extended_switch") if json.loads(row["details_json"]).get("to") == "on"]


def test_the_kill_route_needs_a_system_administrator(lx):
    _store(lx, ext="on")
    lx.flag("u-viewer")
    lx.bind("u-viewer", "viewer")
    assert lx.login(lx.viewer).status_code == 200
    assert lx.client.post("/arx" + KILL, json={}).status_code == 403
    vera = TestClient(lx.app, headers={"X-SW-Dev-User": "vera"})
    assert vera.post(KILL, json={}).status_code == 403
    assert TestClient(lx.app, headers={"Origin": "http://testserver"}).post("/arx" + KILL, json={}).status_code == 401  # no session
    assert _ext(lx) == "on" and _listed(lx) == LISTED
    denied = [r for r in _rows(lx, "identity.service_identity.kill_switch") if r["decision"] == "denied"]
    assert denied and all(r["reason"] in ("not_system_admin", "forbidden") for r in denied)


def test_the_kill_route_refuses_an_arx_only_user(lx):
    lx.enable()
    _store(lx, ext="on")
    created, c = lx.ready("maria", "site_admin")
    assert c.post("/arx" + KILL, json={}).status_code == 403
    assert _ext(lx) == "on" and _listed(lx) == LISTED


def test_the_kill_route_works_on_the_local_channel_too(lx):
    _store(lx, ext="on")
    r = lx.admin.post(KILL, json={})
    assert r.status_code == 200 and r.json()["turned_off"] is True and r.json()["cleared"] == 2
    assert json.loads(_rows(lx, "identity.service_identity.kill_switch")[-1]["details_json"])["channel"] == "local"


def test_the_full_editor_and_the_configuration_stay_local_only(lx):
    c = _remote_admin(lx)
    _store(lx, ext="on")
    assert c.put("/arx/api/v1/identity/service-identity/runnable", json={"entity_ids": []}).status_code == 404
    assert c.put("/arx/api/v1/identity/service-identity/runnable", json={"entity_ids": ["script.x"]}).status_code == 404
    assert c.get("/arx/api/v1/identity/service-identity").status_code == 404
    assert lx.admin.put("/api/v1/identity/service-identity/runnable", json={"entity_ids": ["script.x"]}).status_code == 200
    assert _listed(lx) == ["script.x"]
