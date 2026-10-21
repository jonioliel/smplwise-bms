"""CR-CAMVF-295 (docs/changes/CR-CAMVF-295-SECURITY.md): the live in-page camera viewfinder is an application switch, never a
header change. These tests hold the line:

- every public route (each rule of public_http.ROUTES, through the real edge) answers `camera=()`, whatever a route sends itself;
- the remote channel's Permissions-Policy is exactly the CR-008 value with the switch off AND on (the switch never widens it);
- the Ingress channel carries no Permissions-Policy from Arx with the switch off and on (the HA page governs);
- the switch itself: `ui.camera_viewfinder`, default False, boolean only, system.configure, served to every viewer by
  GET /tickets/module, a corrupt stored value reads as off."""
from __future__ import annotations

import dataclasses
import re

import pytest
from conftest import as_user, bind
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services.tickets import settings_doc
from smplwise.services.tickets.public_http import ROUTES, RouteRule
from tests.tickets_public_fakes import build_world

API = "/api/v1"
PUBLIC_POLICY = "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
REMOTE_POLICY = "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()"  # CR-008 section 3e

_SAMPLES = {"{rid}": "abc123", "{attachment_id}": "a1", "{name}": None}


def _sample_path(rule: RouteRule) -> str:
    path = rule.template
    for key, value in _SAMPLES.items():
        if key in path:
            if key == "{name}":
                value = "0123456789abcdef.jpg" if rule.template.startswith("/t/brand/") else (
                    "index-3f9a1c2e.js" if rule.kind == "asset" else "favicon.svg")
            path = path.replace(key, value)
    assert rule.regex.fullmatch(path), (rule.template, path)
    return path


def _greedy_router() -> APIRouter:
    """A route that tries to widen the policy itself: the edge must replace it."""
    r = APIRouter()

    @r.get("/t/api/test-camera")
    async def greedy() -> JSONResponse:
        return JSONResponse({"ok": True}, headers={"Permissions-Policy": "camera=(self)", "permissions-policy": "camera=*"})

    return r


@pytest.fixture()
def public(tmp_path):
    rules = ROUTES + (RouteRule("GET", r"/t/api/test-camera", "/t/api/test-camera", "static"),)
    return build_world(tmp_path, routers=(_greedy_router(),), rules=rules)


def _policies(resp) -> list[str]:
    return [v.decode("latin-1") for k, v in resp.headers.raw if k.lower() == b"permissions-policy"]


def test_every_public_route_answers_camera_denied(public):
    link, tok = public.links.add()
    c = public.client()
    seen = 0
    for rule in ROUTES:
        path = _sample_path(rule)
        headers = {"x-ticket-token": tok}
        if rule.method == "GET":
            resp = c.get(path, headers=headers)
        elif rule.body == "multipart":
            resp = c.post(path, content=b"", headers={**headers, "content-type": "text/plain"})  # 415 before any read
        else:
            resp = c.post(path, content=b"{}", headers={**headers, "content-type": "application/json"})
        assert _policies(resp) == [PUBLIC_POLICY], (rule.method, path, resp.status_code, _policies(resp))
        seen += 1
    assert seen == len(ROUTES)
    # the document routes (the page shell the viewfinder would need) under the configured prefix too, and an unknown path
    for path in ("/t/", "/t/r/abc123", "/support/", "/support/r/abc123", "/nope", "/t/api/unknown"):
        assert _policies(c.get(path)) == [PUBLIC_POLICY], path


def test_a_public_route_cannot_widen_the_camera_policy(public):
    resp = public.client().get("/t/api/test-camera")
    assert resp.status_code == 200
    assert _policies(resp) == [PUBLIC_POLICY], "the route's own Permissions-Policy is dropped; the edge's one stays"


# ---------------------------------------------------------------- the authenticated app: remote channel and Ingress


def _www(tmp_path):
    www = tmp_path / "www"
    www.mkdir(exist_ok=True)
    (www / "index.html").write_text("<!doctype html><title>Arx</title><sw-app></sw-app>", encoding="utf-8")
    return www


@pytest.fixture()
def app_client(settings, tmp_path):
    c = TestClient(create_app(dataclasses.replace(settings, remote_access=True, www_dir=_www(tmp_path))))
    assert c.get(f"{API}/me").status_code == 200  # joni bootstraps as system_admin (developer identity, local channel)
    assert c.patch(f"{API}/settings", json={"tickets.enabled": "true"}).status_code == 200
    return c


def _set_viewfinder(c: TestClient, on: bool) -> dict:
    doc = c.get(f"{API}/tickets/settings").json()
    r = c.put(f"{API}/tickets/settings", json={"revision": doc["revision"], "ui": {"camera_viewfinder": on}})
    assert r.status_code == 200, r.text
    assert r.json()["ui"]["camera_viewfinder"] is on
    return r.json()


@pytest.mark.parametrize("on", [False, True])
def test_remote_policy_is_the_cr008_value_whatever_the_switch(app_client, on):
    _set_viewfinder(app_client, on)
    for path in ("/arx/", "/arx/index.html", "/arx/api/v1/me", "/arx/api/v1/tickets/module", "/arx/nope"):
        r = app_client.get(path)
        assert _policies(r) == [REMOTE_POLICY], (path, r.status_code)


@pytest.mark.parametrize("on", [False, True])
def test_ingress_carries_no_arx_permissions_policy_whatever_the_switch(app_client, on):
    _set_viewfinder(app_client, on)
    for path in ("/", "/index.html", f"{API}/me", f"{API}/tickets/module"):
        r = app_client.get(path)
        assert _policies(r) == [], (path, _policies(r))


# ---------------------------------------------------------------- the switch


def test_the_switch_is_off_by_default_and_boolean_only():
    default, check = settings_doc.SCHEMA[("ui", "camera_viewfinder")]
    assert default is False
    assert check(True) is True and check(False) is False
    for bad in ("true", 1, None, "on"):
        with pytest.raises(ValueError):
            check(bad)


def test_the_switch_round_trip_permission_and_corrupt_value(app_client, settings):
    c = app_client
    doc = c.get(f"{API}/tickets/settings").json()
    assert doc["ui"]["camera_viewfinder"] is False
    assert c.get(f"{API}/tickets/module").json()["ui"]["camera_viewfinder"] is False
    for bad in ("true", 1, "on"):
        r =c.put(f"{API}/tickets/settings", json={"revision": doc["revision"], "ui": {"camera_viewfinder": bad}})
        assert r.status_code == 422, bad
    # tickets.configure alone is not enough: the installation document is system.configure
    bind(c, settings, "cara", "tickets_configure", "installation", "*")
    r = c.put(f"{API}/tickets/settings", json={"revision": doc["revision"], "ui": {"camera_viewfinder": True}}, headers=as_user("cara"))
    assert r.status_code == 403
    after = _set_viewfinder(c, True)
    assert c.get(f"{API}/tickets/module").json()["ui"]["camera_viewfinder"] is True
    # from the remote channel the save is refused like every other remote write without a session (no widening path there)
    r = c.put(f"/arx{API}/tickets/settings", json={"revision": after["revision"], "ui": {"camera_viewfinder": False}})
    assert r.status_code in (401, 403)
    with c.app.state.db.connection() as conn:
        conn.execute("UPDATE settings SET value = '{\"revision\": 9, \"ui\": {\"camera_viewfinder\": \"yes\"}}' WHERE key = 'tickets.settings'")
    assert c.get(f"{API}/tickets/settings").json()["ui"]["camera_viewfinder"] is False, "a corrupt value reads as off"


def test_the_public_bundle_never_contains_the_viewfinder():
    """T11: the vendor page does not ship getUserMedia (built bundle in smplwise_vms/www-public, when present)."""
    import pathlib

    root = pathlib.Path(__file__).resolve().parents[2] / "www-public"
    files = list(root.rglob("*.js")) if root.is_dir() else []
    if not files:
        pytest.skip("no built public bundle in this checkout")
    for f in files:
        text = f.read_text(encoding="utf-8", errors="replace")
        assert not re.search(r"getUserMedia|ticket-camera-viewfinder", text), f.name
