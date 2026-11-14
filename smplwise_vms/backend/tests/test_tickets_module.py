"""CR-038 slice 1 - the optional-module switch and the shared touch points (section 6): `tickets.enabled` is OFF by default; while off
EVERY tickets route but GET /tickets/module answers the uniform 404 `feature_disabled` (the routes are enumerated from the routers, so a
route a later slice adds is covered too); the switch is system.configure only and audited; /me carries `modules.tickets`; the
installation settings never travel in a project backup; a project restore leaves the module's tables alone; the body limit of the photo
route; the nav order knows the area."""
from __future__ import annotations

import json
import re

import pytest
from conftest import as_user, bind
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from smplwise import body_limit as bl
from smplwise.main import create_app
from smplwise.routers import tickets as tickets_router, tickets_admin
from smplwise.routers.settings import DEFAULTS
from smplwise.services import backup, user_prefs
from smplwise.services.tickets import attachments

API = "/api/v1"
FAKE_ID = "a1b2c3d4e5f60718"


def _gated_routes() -> list[tuple[str, str]]:
    out = []
    for router in (tickets_router.router, tickets_admin.router):
        for r in router.routes:
            if isinstance(r, APIRoute):
                path = re.sub(r"\{kind\}", "user", r.path)
                path = re.sub(r"\{[a-z_]+\}", FAKE_ID, path)
                out.extend((m, API + path) for m in sorted(r.methods))
    return out


GATED = _gated_routes()


def test_the_routers_are_what_the_spec_lists():
    paths = {p for _m, p in GATED}
    assert len(GATED) >= 29  # slice 1's routes; later slices only add
    for must in ("/tickets", "/tickets/meta", "/tickets/assignees", f"/tickets/{FAKE_ID}", f"/tickets/{FAKE_ID}/status", f"/tickets/{FAKE_ID}/assign",
                 f"/tickets/{FAKE_ID}/return", f"/tickets/{FAKE_ID}/notes", f"/tickets/{FAKE_ID}/eta", f"/tickets/{FAKE_ID}/attachments",
                 "/tickets/settings", "/tickets/name", "/tickets/admin/departments", "/tickets/admin/holders", "/tickets/admin/directory"):
        assert API + must in paths, must
    open_paths = [r.path for r in tickets_router.open_router.routes if isinstance(r, APIRoute)]
    assert open_paths == ["/tickets/module"], "the ONE route that answers while the module is off"


def test_off_by_default_and_every_gated_route_answers_the_uniform_404(client):
    assert DEFAULTS["tickets.enabled"] == "false"
    client.get(f"{API}/me")  # the bootstrap administrator: every permission there is
    assert client.get(f"{API}/settings").json()["settings"]["tickets.enabled"] == "false"
    seen_codes = set()
    for method, path in GATED:
        r = client.request(method, path, json={} if method in ("POST", "PUT", "PATCH") and not path.endswith("/attachments") else None)
        body = r.json()
        assert r.status_code == 404 and body["code"] == "feature_disabled", (method, path, r.status_code, body)
        seen_codes.add(body["user_message"])
    assert len(seen_codes) == 1, "one uniform answer"
    m = client.get(f"{API}/tickets/module")
    assert m.status_code == 200 and m.json()["enabled"] is False and m.json()["public_ready"] is False
    assert client.get(f"{API}/me").json()["modules"]["tickets"] is False


def test_the_module_state_needs_a_signed_in_caller_and_the_gate_comes_after_authentication(settings):
    import dataclasses

    app = create_app(dataclasses.replace(settings, dev_user=None))
    c = TestClient(app)
    assert c.get(f"{API}/tickets/module").status_code == 401
    assert c.get(f"{API}/tickets").status_code == 401, "401 before 404: an anonymous caller learns nothing"


def test_the_switch_is_system_configure_only_and_audited(client, settings):
    client.get(f"{API}/me")
    bind(client, settings, "sam", "site_admin", "installation", "*")
    assert client.patch(f"{API}/settings", json={"tickets.enabled": "true"}, headers=as_user("sam")).status_code == 403
    assert client.patch(f"{API}/settings", json={"tickets.enabled": "true"}).status_code == 200
    assert client.patch(f"{API}/settings", json={"tickets.enabled": "true"}).status_code == 200  # no change: no second row
    assert client.get(f"{API}/tickets/module").json()["enabled"] is True
    assert client.get(f"{API}/me").json()["modules"]["tickets"] is True
    assert client.get(f"{API}/tickets").status_code == 200
    assert client.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    assert client.patch(f"{API}/settings", json={"tickets.enabled": "maybe"}).status_code == 422
    with client.app.state.db.connection(mode="read") as conn:
        actions = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'tickets.module.%' ORDER BY id").fetchall()]
    assert actions == ["tickets.module.enable", "tickets.module.disable"]


def test_turning_the_module_off_keeps_the_data_and_on_again_brings_it_back(client):
    client.get(f"{API}/me")
    client.patch(f"{API}/settings", json={"tickets.enabled": "true"})
    t = client.post(f"{API}/tickets", json={"department_id": "dept-maintenance", "title": "נורה שרופה", "client_request_id": "req-keep-0001"}).json()
    client.patch(f"{API}/settings", json={"tickets.enabled": "false"})
    assert client.get(f"{API}/tickets/{t['id']}").json()["code"] == "feature_disabled"
    client.patch(f"{API}/settings", json={"tickets.enabled": "true"})
    assert client.get(f"{API}/tickets/{t['id']}").json()["number"] == t["number"]


# ---------------------------------------------------------------- backups (review C4 / T13; slice-1 notes on the module's tables)

def test_installation_settings_never_travel_in_a_project_backup(client):
    for key in ("tickets.enabled", "tickets.settings", "tickets.name", "messaging.whatsapp"):
        assert key in backup.SETTINGS_KEEP, key
    client.get(f"{API}/me")
    client.patch(f"{API}/settings", json={"tickets.enabled": "true"})
    client.put(f"{API}/tickets/name", json={"revision": 0, "he": {"one": "תקלה", "many": "תקלות", "gender": "f"}})
    client.put(f"{API}/tickets/settings", json={"revision": 0, "ui": {"detail": "drawer"}})
    with client.app.state.db.connection(mode="read") as conn:
        snap = backup.snapshot(conn)
    keys = {r["key"] for r in snap["settings"]}
    assert not keys & {"tickets.enabled", "tickets.settings", "tickets.name"}
    assert not [t for t in snap if t.startswith("ticket")], "slice 1: the module's tables are not project tables"


def test_a_replace_restore_leaves_the_tickets_and_their_departments_alone(client):
    """An archive written while the module was off is restored over an installation with an open ticket: the restore succeeds (no
    department a ticket points at is deleted), the ticket and the switch stay as they were."""
    client.get(f"{API}/me")
    r = client.post(f"{API}/backups", json={"note": "before tickets"})
    assert r.status_code == 201, r.text
    name = r.json()["name"]
    client.patch(f"{API}/settings", json={"tickets.enabled": "true"})
    t = client.post(f"{API}/tickets", json={"department_id": "dept-maintenance", "title": "דלת תקועה", "client_request_id": "req-restore-01"}).json()
    r = client.post(f"{API}/backups/{name}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert r.status_code == 200, r.text
    assert client.get(f"{API}/tickets/module").json()["enabled"] is True, "the switch is the installation's, never restored"
    assert client.get(f"{API}/tickets/{t['id']}").json()["number"] == t["number"]


# ---------------------------------------------------------------- the shared touch points

def test_the_photo_route_has_its_own_body_limit(settings):
    assert bl.route_limit("POST", f"{API}/tickets/{FAKE_ID}/attachments", settings) == (attachments.MAX_BYTES + bl.MULTIPART_SLACK, "ticket_attachment")
    assert bl.route_limit("POST", f"{API}/tickets/{FAKE_ID}/notes", settings)[0] == bl.DEFAULT_MAX
    assert attachments.MAX_BYTES == 8 * 1024 * 1024


def test_the_nav_order_knows_the_area_and_appends_it_last():
    assert user_prefs.NAV_TAB_IDS[-1] == "tickets"
    assert user_prefs.normalize_nav_order(["infra", "devices"])[-1] == "tickets"


def test_settings_listing_carries_the_switch_but_never_the_documents(client):
    client.get(f"{API}/me")
    s = client.get(f"{API}/settings").json()["settings"]
    assert "tickets.enabled" in s and "tickets.settings" not in s and "tickets.name" not in s and "messaging.whatsapp" not in s
    assert json.dumps(s, ensure_ascii=False).count("tickets.") == 1
