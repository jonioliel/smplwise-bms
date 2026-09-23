"""Server-side authorization: bootstrap admin, scoped bindings, the contract's expected test vectors,
and the mandatory acceptance case (ordinary HA user as editor of floor 2 cannot touch floor 3,
users or system settings)."""
from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.main import create_app
from smplwise.rbac import Principal, authorize

ROOT = Path(__file__).resolve().parents[3]


def test_bootstrap_admin_granted_once(client):
    me = client.get("/api/v1/me").json()
    assert me["user"]["username"] == "joni"
    assert any(b["role_id"] == "system_admin" and b["scope_type"] == "installation" for b in me["bindings"])
    assert me["bootstrap_state"].startswith("done:")
    again = client.get("/api/v1/me").json()
    assert len([b for b in again["bindings"] if b["role_id"] == "system_admin"]) == 1


def test_unassigned_user_sees_nothing(client):
    seed_tree(client)
    me = client.get("/api/v1/me", headers=as_user("codex")).json()
    assert me["has_access"] is False and me["bindings"] == []
    tree = client.get("/api/v1/sites", headers=as_user("codex")).json()
    assert tree["sites"] == [] and tree["can_create_site"] is False


def test_floor_editor_scope(client, settings):
    """Mandatory acceptance: an ordinary HA user who is editor of floor 2."""
    ids = seed_tree(client)
    bind(client, settings, "dana", "editor", "floor", ids["floor2"])
    h = as_user("dana")
    tree = client.get("/api/v1/sites", headers=h).json()
    floors = [f["id"] for f in tree["sites"][0]["buildings"][0]["floors"]]
    assert floors == [ids["floor2"]], "editor of floor 2 must not even see floor 3"
    assert client.patch(f"/api/v1/floors/{ids['floor2']}", json={"name": "x"}, headers=h).status_code == 403, "map editing is not content configuration"
    assert client.get(f"/api/v1/floors/{ids['floor3']}/map", headers=h).status_code == 403
    assert client.post("/api/v1/sites", json={"name": "y"}, headers=h).status_code == 403
    assert client.post("/api/v1/cameras/sync", headers=h).status_code == 403
    m = client.get(f"/api/v1/floors/{ids['floor2']}/map", headers=h).json()
    assert m["permissions"] == {"edit": True, "publish": True, "import": True, "structure": True}
    # the refusal itself is audited
    with Database(settings.db_path).connection() as conn:
        denied = conn.execute("SELECT action, resource_type, reason FROM audit_log WHERE decision = 'denied' AND actor_username = 'dana'").fetchall()
    assert ("map.read", "floor", "no_binding") in {(d[0], d[1], d[2]) for d in denied}


def test_contract_authorization_vectors(client, settings):
    """contracts/examples/authorization-scenarios.design.json against the real authorize()."""
    vectors = json.loads((ROOT / "contracts" / "examples" / "authorization-scenarios.design.json").read_text(encoding="utf-8"))
    ids = seed_tree(client)
    site_b = client.post("/api/v1/sites", json={"name": "אתר ב"}).json()["id"]
    bld_b = client.post(f"/api/v1/sites/{site_b}/buildings", json={"name": "מבנה ב"}).json()["id"]
    floor2_b = client.post(f"/api/v1/buildings/{bld_b}/floors", json={"name": "קומה 2 (ב)", "level": 2}).json()["id"]
    scope_map = {
        "floor-2": ("floor", ids["floor2"]), "floor-3": ("floor", ids["floor3"]), "floor-1-site-a": ("floor", ids["floor3"]),
        "floor-2-site-b": ("floor", floor2_b), "site-a": ("site", ids["site"]), "site-b": ("site", site_b),
        "installation": ("installation", "*"), "door-floor-2": ("floor", ids["floor2"]), "camera-floor-2": ("floor", ids["floor2"]),
    }
    # Cases that need identity transport, media sessions or group delegation live in other tests / tasks.
    covered_elsewhere = {
        "ha-control-denied": "HA-side permission intersection arrives with the bridge (T077)",
        "forged-ingress-identity": "test_identity_required_without_dev_mode",
        "revoke-stream": "media sessions (T016)",
        "delegated-group-cross-scope": "group management API (T083)",
    }
    db = Database(settings.db_path)
    checked = 0
    all_cases = [c for value in vectors.values() if isinstance(value, list) for c in value if isinstance(c, dict) and "id" in c]
    assert len(all_cases) >= 17, "the contract pack should carry the v1.0 and v1.1 vectors"
    for i, case in enumerate(all_cases):
        if case["id"] in covered_elsewhere:
            continue
        user = f"vec{i}"
        principal = Principal(f"dev-{user}", user, user, "dev")
        client.get("/api/v1/me", headers=as_user(user))  # creates the user row
        bindings = case.get("bindings") or ([{"role": case["role"], "scope": case.get("scope") or "installation"}] if case.get("role") else [])
        for b in bindings:
            scope = scope_map[b["scope"]]
            bind(client, settings, user, b["role"], scope[0], scope[1])
        if case["id"] == "known-deleted-user":
            with db.connection() as conn:
                conn.execute("UPDATE users SET active = 0 WHERE id = ?", (principal.user_id,))
            action, target = "map.read", ("installation", "*")
        elif case["id"] == "same-name-new-user-id":
            # bindings belong to the old user id; a new HA user with the same name gets nothing
            bind(client, settings, user, "system_admin", "installation", "*")
            principal = Principal("dev-vec-new-id", user, user, "dev")
            action, target = "map.read", ("installation", "*")
        else:
            action, target = case["action"], scope_map[case["target"]]
        with db.connection() as conn:
            decision = authorize(conn, principal, action, target)
        assert decision.allowed == case["expected_allow"], f"{case['id']}: {case.get('reason', '')} (got {decision})"
        checked += 1
    assert checked == len(all_cases) - len(covered_elsewhere)


def test_identity_required_without_dev_mode(settings, tmp_path):
    strict = replace(settings, dev_user=None, data_dir=tmp_path / "strict")
    c = TestClient(create_app(strict))
    r = c.get("/api/v1/me")
    assert r.status_code == 401 and r.json()["code"] == "untrusted_origin"
    # even a forged identity header from an untrusted origin is ignored
    r = c.get("/api/v1/me", headers={"X-Remote-User-Id": "attacker", "X-Remote-User-Name": "joni"})
    assert r.status_code == 401


@pytest.mark.parametrize("header_present", [True, False])
def test_ingress_identity_from_trusted_proxy(settings, tmp_path, header_present):
    strict = replace(settings, dev_user=None, data_dir=tmp_path / f"ingress-{header_present}", trusted_proxies=("testclient",))
    c = TestClient(create_app(strict))
    headers = {"X-Remote-User-Id": "ha-user-1", "X-Remote-User-Name": "joni", "X-Remote-User-Display-Name": "Yoni O."} if header_present else {}
    r = c.get("/api/v1/me", headers=headers)
    if header_present:
        assert r.status_code == 200
        me = r.json()
        assert me["user"] == {"id": "ha-user-1", "username": "joni", "display_name": "Yoni O.", "source": "ingress"}
        assert me["has_access"] is True, "bootstrap admin username matched"
    else:
        assert r.status_code == 401 and r.json()["code"] == "identity_missing"
