"""Shared fixtures of the CR-017 automations tests: an app whose Home Assistant is a FakeHaConfig (tests/fake_ha_config.py, seeded with the
probe-like items of tests/automations_seed.py), whose mirror holds the matching entities, whose bridge is paired at 0.6.0 and whose transport is the fake one
(no network, no Home Assistant). Import with `from automations_fixture import *  # noqa` in a test module."""
from __future__ import annotations

import copy
import uuid
from dataclasses import replace
from typing import Any

import pytest
from conftest import as_user, bind, seed_tree  # noqa: F401
from fastapi.testclient import TestClient

import fake_ha_config
from fake_ha_config import FakeHaConfig, FakeTransport
from automations_seed import NOTIFY, SHABBAT
from smplwise.services import automation_ops, automation_transport, automations, ha_bridge

BOSS = {"X-SW-Dev-User": "boss"}
OMER = {"X-SW-Dev-User": "omer"}
API = "/api/v1"

__all__ = ["autos_app", "rid", "grant", "place", "role", "as_user", "bind", "seed_tree", "directory", "get_item", "item_by_name", "draft_of", "typed_state_trigger", "svc_block", "locked_copy",
           "put_item", "create_item", "SHABBAT", "NOTIFY", "OMER", "API", "BOSS", "fake_ha_config", "provision"]

_n = [0]


def rid() -> str:
    _n[0] += 1
    return f"auto-req-{_n[0]:06d}-{uuid.uuid4().hex[:6]}"


def directory(c: TestClient, secret: str, *, admins: tuple[str, ...] = ("dev-joni",), delegated: bool = False, changed_at: str | None = None, others: tuple[str, ...] = ("dev-omer", "dev-vera")) -> None:
    users = [{"id": u, "name": u, "username": u.split("-", 1)[1], "is_active": True, "is_admin": True, "group_ids": []} for u in admins]
    users += [{"id": u, "name": u, "username": u.split("-", 1)[1], "is_active": True, "is_admin": False, "group_ids": []} for u in others if u not in admins]
    r = c.post("/api/v1/ha/bridge/directory", json=ha_bridge.sign(secret, {"users": users, "version": "0.6.0", "delegated_authoring": delegated, "delegation_changed_at": changed_at}))
    assert r.status_code == 200, r.text


@pytest.fixture()
def autos_app(settings, monkeypatch):
    """(app, settings, client, fake, transport). The feature is ON, the Shabbat sensor is set, `joni` (the bootstrap administrator) is the caller and an HA
    administrator, `omer` / `vera` are HA non-administrators, the bridge is paired at 0.6.0 and the delegation switch is off."""
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="secret-token-value")
    from smplwise.main import create_app

    app = create_app(s)
    fake = FakeHaConfig().seed()
    fake_ha_config.seed_mirror(app.state.db, fake)
    c = TestClient(app)
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    fake.secret = secret
    assert c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.6.0"})).status_code == 200
    directory(c, secret)
    tr = FakeTransport(fake, secret)
    automation_transport.set_transport(tr)
    fake.on_change = lambda: fake_ha_config.seed_mirror(app.state.db, fake)
    automations.MIRROR.reset()
    automations.MIRROR.debounce_s = 0
    automations.MIRROR.clock = lambda: fake.now()
    automations.MIRROR.bind(app.state.db, s)
    automation_ops.reset_limits()
    assert c.patch("/api/v1/settings", json={"automations.enabled": "true", "schedules.shabbat_sensor": SHABBAT, "schedules.shabbat_sensor_force": True,
                                             "automations.notify_targets": [NOTIFY]}).status_code == 200
    yield app, s, c, fake, tr
    import datetime as dt

    automation_transport.set_transport(None)
    automations.MIRROR.debounce_s = automations.FETCH_DEBOUNCE_S
    automations.MIRROR.clock = lambda: dt.datetime.now(dt.timezone.utc)
    automations.MIRROR.reset()
    automation_ops.reset_limits()


def provision(app, c, fake, tr) -> None:
    """Run the first pull now (the first read does it too)."""
    automations.MIRROR.pull(None, "test")


def role(c: TestClient, name: str, permissions: list[str], sensitive: list[str] | None = None) -> str:
    r = c.post("/api/v1/access/roles", json={"name": name, "permissions": permissions, "sensitive": sensitive or []})
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


_PUBLISHED: set[str] = set()


def place(c: TestClient, floor_id: str, *entity_ids: str) -> None:
    """Anchor HA entities on a floor's map (a floor needs a published plan before anything is placed on it)."""
    from conftest import png_bytes

    if floor_id not in _PUBLISHED:
        asset = c.post(f"/api/v1/floors/{floor_id}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")}).json()
        v = c.post(f"/api/v1/floors/{floor_id}/plan-versions", json={"asset_id": asset["id"]}).json()
        assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
        _PUBLISHED.add(floor_id)
    for e in entity_ids:
        assert c.post(f"/api/v1/floors/{floor_id}/anchors", json={"resource_type": "ha_entity", "resource_id": e, "x": 0.2, "y": 0.2}).status_code == 201, e


def grant(c: TestClient, user: str, name: str, permissions: list[str], sensitive: list[str], scope_type: str, scope_id: str) -> str:
    """A custom role bound to `user` (dev identity) at a scope; the user row is created first."""
    c.get("/api/v1/me", headers=as_user(user))
    rid_ = role(c, name, permissions, sensitive)
    r = c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": f"dev-{user}", "role_id": rid_, "scope_type": scope_type, "scope_id": scope_id})
    assert r.status_code == 201, r.text
    return rid_


def get_item(c: TestClient, kind: str, item_id: str, headers: dict[str, str] | None = None):
    return c.get(f"{API}/automations/{kind}/{item_id}", headers=headers or {})


def item_by_name(c: TestClient, name: str, kind: str | None = None, headers: dict[str, str] | None = None) -> dict[str, Any]:
    r = c.get(f"{API}/automations", params={"limit": 500, **({"kind": kind} if kind else {})}, headers=headers or {})
    assert r.status_code == 200, r.text
    return next(i for i in r.json()["items"] if i["name"] == name)


def typed_state_trigger(entity: str = "binary_sensor.motion_hall", to: str = "on", uid: str = "n1") -> dict[str, Any]:
    return {"uid": uid, "kind": "typed", "type": "state", "entity_ids": [entity], "from": None, "to": to, "for": None, "id": None, "raw": None, "sentence": ""}


def svc_block(action: str, entity_ids: list[str], data: dict[str, Any] | None = None, uid: str = "n2", role_: str = "device") -> dict[str, Any]:
    return {"uid": uid, "kind": "typed", "type": "service", "action": action, "entity_ids": entity_ids, "data": data or {}, "role": role_, "raw": None, "sentence": ""}


def draft_of(alias: str = "אוטומציה חדשה", *, triggers: list[dict[str, Any]] | None = None, conditions: list[dict[str, Any]] | None = None, actions: list[dict[str, Any]] | None = None,
             mode: str = "single") -> dict[str, Any]:
    return {"alias": alias, "description": "", "mode": mode, "max": None, "triggers": triggers if triggers is not None else [typed_state_trigger()], "conditions": conditions or [],
            "actions": actions if actions is not None else [svc_block("light.turn_on", ["light.office"], {"brightness_pct": 40})]}


def locked_copy(block: dict[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(block)


def create_item(c: TestClient, kind: str, draft: dict[str, Any], headers: dict[str, str] | None = None, **extra: Any):
    return c.post(f"{API}/automations/{kind}", json={"draft": draft, "client_request_id": rid(), **extra}, headers=headers or {})


def put_item(c: TestClient, kind: str, item_id: str, draft: dict[str, Any], base_revision: str, headers: dict[str, str] | None = None, **extra: Any):
    return c.put(f"{API}/automations/{kind}/{item_id}", json={"draft": draft, "base_revision": base_revision, "client_request_id": rid(), **extra}, headers=headers or {})
