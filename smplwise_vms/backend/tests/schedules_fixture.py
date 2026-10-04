"""Shared fixtures of the CR-014 schedules tests: an app whose scheduler component is a FakeScheduler (tests/fake_scheduler.py,
seeded with the twelve anonymised patterns of §9.4), whose mirror holds the matching generic entities, whose bridge is paired
at 0.3.0 and whose transport is the fake one (no network, no Home Assistant). Import with
`from schedules_fixture import *  # noqa` in a test module."""
from __future__ import annotations

import uuid
from dataclasses import replace
from typing import Any

import pytest
from conftest import as_user, bind, seed_tree  # noqa: F401
from fastapi.testclient import TestClient

import fake_scheduler
from fake_scheduler import SHABBAT, FakeScheduler, FakeTransport
from smplwise.services import alarm_codes as codes
from smplwise.services import ha_bridge, schedule_ops, schedules

BOSS = {"X-SW-Dev-User": "boss"}

__all__ = ["grant", "place", "BOSS", "SHABBAT", "sched_app", "put_draft", "post_json", "rid", "as_user", "bind", "seed_tree", "role", "draft_of", "slot", "act", "cond", "fake_scheduler",
           "allow_disarm"]

_n = [0]


def rid() -> str:
    _n[0] += 1
    return f"sched-req-{_n[0]:06d}-{uuid.uuid4().hex[:6]}"


@pytest.fixture()
def sched_app(settings, monkeypatch):
    """(app, settings, client, fake, transport). The feature is ON, the Shabbat sensor is set, and `joni` (the bootstrap
    administrator of the test settings) is the caller."""
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="secret-token-value")
    from smplwise.main import create_app

    app = create_app(s)
    fake = FakeScheduler()
    fake_scheduler.seed_live_like(fake)
    fake_scheduler.seed_mirror(app.state.db, fake)
    c = TestClient(app)
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    assert c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.3.0"})).status_code == 200
    tr = FakeTransport(fake, secret)
    schedules.set_transport(tr)
    schedules.MIRROR.reset()
    schedules.MIRROR.debounce_s = 0
    schedules.MIRROR.clock = lambda: fake.now()
    schedules.MIRROR.bind(app.state.db, s)
    schedule_ops.reset_limits()
    codes.LOCKOUT.reset()
    assert c.patch("/api/v1/settings", json={"schedules.enabled": "true", "schedules.shabbat_sensor": SHABBAT, "schedules.shabbat_sensor_force": True}).status_code == 200
    yield app, s, c, fake, tr
    import datetime as dt

    schedules.set_transport(None)
    schedules.MIRROR.debounce_s = schedules.FETCH_DEBOUNCE_S
    schedules.MIRROR.clock = lambda: dt.datetime.now(dt.timezone.utc)
    schedules.MIRROR.reset()
    codes.LOCKOUT.reset()


def allow_disarm(c: TestClient) -> None:
    """A system administrator (the bootstrap `joni`) allows scheduled disarming, typing the confirmation (2026-10-04: off by default)."""
    r = c.patch("/api/v1/settings", json={"schedules.allow_disarm": "true", "schedules.allow_disarm_confirm": "אפשר נטרול"})
    assert r.status_code == 200, r.text


def role(c: TestClient, name: str, permissions: list[str], sensitive: list[str] | None = None) -> str:
    """A custom role (the documented recipe for an editor: `schedule.view` + sensitive `schedule.manage`)."""
    r = c.post("/api/v1/access/roles", json={"name": name, "permissions": permissions, "sensitive": sensitive or []})
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


# ---------------------------------------------------------------- draft helpers

def act(service: str, entity_id: str, **data: Any) -> dict[str, Any]:
    return {"service": service, "entity_id": entity_id, "data": data}


def slot(start: str, stop: str | None, *actions: dict[str, Any]) -> dict[str, Any]:
    return {"start": start, "stop": stop, "actions": list(actions)}


def cond(value: str = "on", entity: str = SHABBAT) -> dict[str, Any]:
    return {"entity_id": entity, "attribute": "state", "match_type": "is", "value": value}


def draft_of(name: str = "New schedule", slots: list[dict[str, Any]] | None = None, *, weekdays: list[str] | None = None, conditions: list[dict[str, Any]] | None = None, **kw: Any) -> dict[str, Any]:
    return {
        "name": name, "weekdays": weekdays or ["daily"], "start_date": kw.get("start_date"), "end_date": kw.get("end_date"), "repeat": kw.get("repeat", "repeat"), "tags": kw.get("tags", []),
        "conditions": {"items": conditions or [], "type": "or" if conditions else None, "track": bool(kw.get("track", False))},
        "slots": slots if slots is not None else [slot("18:00:00", "19:00:00", act("light.turn_on", "light.office", brightness=80)), slot("19:00:00", "00:00:00", act("light.turn_off", "light.office"))],
    }


def post_json(c: TestClient, path: str, body: dict[str, Any], headers: dict[str, str] | None = None, method: str = "post"):
    return getattr(c, method)(f"/api/v1{path}", json=body, headers=headers or {})


def put_draft(c: TestClient, sid: str, draft: dict[str, Any], base_revision: str, headers: dict[str, str] | None = None, **extra: Any):
    return c.put(f"/api/v1/schedules/{sid}", json={"draft": draft, "base_revision": base_revision, "client_request_id": rid(), **extra}, headers=headers or {})


# ---------------------------------------------------------------- scope helpers

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
