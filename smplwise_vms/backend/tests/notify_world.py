"""A small world for the CR-018 notification tests: a floor-2 camera, an entity placed on floor 2, users with different reach, a fake push
service and helpers to emit, flush the outbox synchronously and read the inbox as a user."""
from __future__ import annotations

import datetime as dt
import json

import httpx
import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient
from test_push import Browser, FakePushService

from smplwise.main import create_app
from smplwise.services import notify, notify_channels
from smplwise.services import push as svc

API = "/api/v1"
REAL_NOW = notify.now_utc  # monkeypatch.undo() would also undo the fake push transport; tests put the clock back with this
NOW = dt.datetime(2026, 10, 1, 9, 0, tzinfo=dt.timezone.utc)  # 12:00 in Asia/Jerusalem (quiet hours are 22:00-07:00 by default)


@pytest.fixture()
def fake_push(monkeypatch):
    fake = FakePushService()
    monkeypatch.setattr(svc, "TRANSPORT", httpx.MockTransport(fake.handler))
    monkeypatch.setattr(svc, "BACKOFF_S", (0.0, 0.0, 0.0))
    svc.reset_limits()
    yield fake
    svc.NOTIFIER.shutdown()
    svc.reset_limits()


class World:
    """joni = system administrator (holds notify.manage); ops2 = operator on floor 2; ops3 = operator on floor 3; vera = viewer (installation)."""

    def __init__(self, settings) -> None:
        self.settings = settings
        self.app = create_app(settings)
        self.c = TestClient(self.app)
        self.db = self.app.state.db
        self.ids = seed_tree(self.c)
        self.cam = self.c.post(f"{API}/cameras", json={"channel": 1, "alias": "לובי"}).json()["id"]
        for f in (self.ids["floor2"], self.ids["floor3"]):
            asset = self.c.post(f"{API}/floors/{f}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
            v = self.c.post(f"{API}/floors/{f}/plan-versions", json={"asset_id": asset["id"]}).json()
            self.c.post(f"{API}/plan-versions/{v['id']}/publish")
        assert self.c.post(f"{API}/floors/{self.ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": self.cam, "x": 0.3, "y": 0.3}).status_code in (200, 201)
        bind(self.c, settings, "ops2", "operator", "floor", self.ids["floor2"])
        bind(self.c, settings, "ops3", "operator", "floor", self.ids["floor3"])
        bind(self.c, settings, "vera", "viewer", "installation", "*")
        self.c.get(f"{API}/me", headers=as_user("nobody"))  # a user with no binding at all
        self.browsers: dict[str, Browser] = {}

    # -- entities
    def entity(self, entity_id: str, domain: str = "binary_sensor", cls: str | None = None, state: str = "off", area: str | None = "kitchen", name: str | None = None,
               floor: str | None = None) -> str:
        now = "2026-10-01T08:00:00Z"
        with self.db.connection() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO ha_entities(entity_id, area_id, area_name, name, domain, device_class, state, attributes_json, last_changed, state_seen_at, available, first_seen_at, updated_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?)",
                (entity_id, area, "מטבח" if area else None, name or entity_id, domain, cls, state, "{}", now, now, now, now),
            )
        if floor:
            r = self.c.post(f"{API}/floors/{floor}/anchors", json={"resource_type": "ha_entity", "resource_id": entity_id, "x": 0.2, "y": 0.2})
            assert r.status_code == 201, r.text
        return entity_id

    # -- push devices
    def subscribe(self, *users: str) -> None:
        for u in users:
            b = self.browsers[u] = Browser(u)
            assert self.c.post(f"{API}/push/subscriptions", json=b.body(), headers=as_user(u)).status_code == 201

    # -- emitting and flushing
    def emit(self, source: str, kind: str, subject: str | None, **kw):
        with self.db.connection() as conn:
            return notify.emit_full(conn, notify.Signal(source, kind, subject, **kw))

    def flush(self) -> int:
        return notify_channels.process_outbox_now(self.db)

    def notifier(self) -> "svc.PushNotifier":
        n = svc.PushNotifier()
        n.db = self.db
        return n

    def inbox(self, user: str = "joni", **params) -> list[dict]:
        r = self.c.get(f"{API}/notifications", params=params, headers=as_user(user))
        assert r.status_code == 200, r.text
        return r.json()["notifications"]

    def recipients(self, nid: str) -> set[str]:
        with self.db.connection(mode="read") as conn:
            return {r[0].removeprefix("dev-") for r in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (nid,)).fetchall()}

    def row(self, nid: str):
        with self.db.connection(mode="read") as conn:
            return conn.execute("SELECT * FROM notifications WHERE id = ?", (nid,)).fetchone()

    def deliveries(self, nid: str | None = None) -> list[dict]:
        with self.db.connection(mode="read") as conn:
            sql = "SELECT * FROM notification_deliveries" + (" WHERE notification_id = ?" if nid else "") + " ORDER BY created_at, id"
            return [dict(r) for r in conn.execute(sql, (nid,) if nid else ()).fetchall()]

    def set_settings(self, **body):
        r = self.c.put(f"{API}/notify/settings", json=body)
        assert r.status_code == 200, r.text
        return r.json()

    def set_policy(self, source: str, **body):
        r = self.c.put(f"{API}/notify/policies/{source}", json=body)
        assert r.status_code == 200, r.text
        return r.json()

    def get_policy_enabled(self, source: str) -> bool:
        return self.c.get(f"{API}/notify/policies/{source}").json()["enabled"]
